-- Ventas históricas (importadas del sistema anterior) y reportes de ventas por mes/día.
--
-- Las ventas del sistema anterior no traen el detalle de productos, solo totales, método de pago y saldo.
-- Por eso viven en su propia tabla: no tocan inventario ni caja (una venta importada nunca aparece como
-- "venta del día" en Caja) y los reportes y el historial de cada cliente las suman junto con las ventas
-- del punto de venta.
--
-- Hora: se guarda en UTC y se agrupa en hora de México (UTC-6, sin horario de verano), igual que el resto de la app.

create type estatus_venta_historica as enum ('pagada', 'deuda_pendiente', 'impaga', 'reembolsada', 'cancelada');

create table ventas_historicas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,                 -- número de venta del sistema anterior (#5595)
  fecha timestamptz not null,
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nombre text,                            -- tal como venía en el archivo
  cajero text,
  vendedor text,
  caja text,
  estatus estatus_venta_historica not null,
  entrega text,                                   -- Entregados / No Entregados / Devueltos / Cancelada
  subtotal numeric(12,2) not null,                -- ya sin lo reembolsado
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null,                   -- total original de la venta
  reembolsos numeric(12,2) not null default 0,
  total_actualizado numeric(12,2) not null,       -- total - reembolsos: la venta neta
  pago_efectivo numeric(12,2) not null default 0,
  pago_tarjeta numeric(12,2) not null default 0,
  pago_transferencia numeric(12,2) not null default 0,
  deuda_inicial numeric(12,2) not null default 0,
  deuda_actual numeric(12,2) not null default 0,
  vencimiento_deuda date,
  facturada boolean not null default false,
  nota text,
  -- Lo que falta por cobrar: la deuda vigente, o todo lo no pagado en una venta "impaga".
  saldo_pendiente numeric(12,2) generated always as (
    case estatus
      when 'deuda_pendiente' then deuda_actual
      when 'impaga' then greatest(total_actualizado - pago_efectivo - pago_tarjeta - pago_transferencia, 0)
      else 0
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index idx_ventas_historicas_fecha on ventas_historicas (fecha);
create index idx_ventas_historicas_cliente on ventas_historicas (cliente_id) where cliente_id is not null;

alter table ventas_historicas enable row level security;
create policy "con_permiso_leen_ventas_historicas" on ventas_historicas for select
  using (fn_tiene_permiso('modulo.reportes') or fn_tiene_permiso('modulo.clientes'));

-- ---------------------------------------------------------------------------------------------
-- Reportes. Se calculan en la base de datos (son miles de filas y el API devuelve máximo 1,000).
-- ---------------------------------------------------------------------------------------------

-- Una fila por venta no cancelada de las dos fuentes, con la hora ya en México.
create or replace function fn_ventas_unificadas()
returns table (
  origen text, fecha_local timestamp, cliente_id uuid, cliente text, cajero text,
  bruto numeric, descuento numeric, reembolsos numeric, neto numeric,
  efectivo numeric, tarjeta numeric, transferencia numeric, por_cobrar numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select 'historica', (h.fecha at time zone 'UTC') - interval '6 hours', h.cliente_id,
         case when h.cliente_nombre is null or lower(h.cliente_nombre) = 'público en general' then null else h.cliente_nombre end,
         h.cajero,
         h.subtotal, h.descuento, h.reembolsos, h.total_actualizado,
         h.pago_efectivo, h.pago_tarjeta, h.pago_transferencia, h.saldo_pendiente
  from ventas_historicas h
  where h.estatus <> 'cancelada'
  union all
  select 'pos', (v.created_at at time zone 'UTC') - interval '6 hours', v.cliente_id, c.nombre_comercial, p.nombre_completo,
         v.subtotal, v.descuento, 0::numeric, v.total,
         coalesce(sum(vp.monto) filter (where vp.metodo = 'efectivo'), 0),
         coalesce(sum(vp.monto) filter (where vp.metodo = 'tarjeta'), 0),
         coalesce(sum(vp.monto) filter (where vp.metodo = 'transferencia'), 0),
         0::numeric
  from ventas v
  left join clientes c on c.id = v.cliente_id
  left join perfiles p on p.id = v.vendedor_id
  left join venta_pagos vp on vp.venta_id = v.id
  where v.estatus = 'completada'
  group by v.id, c.nombre_comercial, p.nombre_completo;
$$;
revoke all on function fn_ventas_unificadas() from public, anon, authenticated;

-- Ventas agrupadas por mes ('mes'), día ('dia') o año ('anio') entre dos fechas (inclusive, hora de México).
create or replace function fn_reporte_ventas(p_desde date, p_hasta date, p_agrupar text default 'mes')
returns table (
  periodo date, ventas bigint, bruto numeric, descuentos numeric, reembolsos numeric, neto numeric,
  efectivo numeric, tarjeta numeric, transferencia numeric, por_cobrar numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unidad text;
begin
  if not fn_tiene_permiso('modulo.reportes') then
    raise exception 'No tienes permiso para ver los reportes';
  end if;
  v_unidad := case p_agrupar when 'dia' then 'day' when 'anio' then 'year' when 'mes' then 'month' else null end;
  if v_unidad is null then raise exception 'Agrupación inválida: usa mes, dia o anio'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El rango de fechas no es válido'; end if;

  return query
  select date_trunc(v_unidad, u.fecha_local)::date, count(*), sum(u.bruto), sum(u.descuento), sum(u.reembolsos), sum(u.neto),
         sum(u.efectivo), sum(u.tarjeta), sum(u.transferencia), sum(u.por_cobrar)
  from fn_ventas_unificadas() u
  where u.fecha_local >= p_desde::timestamp and u.fecha_local < (p_hasta + 1)::timestamp
  group by 1
  order by 1;
end;
$$;

-- Las mejores filas del periodo por cliente ('cliente', sin las ventas sin cliente) o por quien cobró ('cajero').
create or replace function fn_reporte_ventas_por(p_desde date, p_hasta date, p_dimension text, p_limite integer default 15)
returns table (clave text, ventas bigint, neto numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fn_tiene_permiso('modulo.reportes') then
    raise exception 'No tienes permiso para ver los reportes';
  end if;
  if p_dimension not in ('cliente', 'cajero') then raise exception 'Dimensión inválida: usa cliente o cajero'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'El rango de fechas no es válido'; end if;

  return query
  select coalesce(case p_dimension when 'cliente' then u.cliente else u.cajero end,
                  case p_dimension when 'cliente' then 'Público en general' else 'Sin cajero' end),
         count(*), sum(u.neto)
  from fn_ventas_unificadas() u
  where u.fecha_local >= p_desde::timestamp and u.fecha_local < (p_hasta + 1)::timestamp
    -- En el ranking de clientes no entran las ventas de mostrador sin cliente ("Público en general").
    and (p_dimension <> 'cliente' or u.cliente is not null)
  group by 1
  order by 3 desc, 1
  limit greatest(p_limite, 1);
end;
$$;

-- Primera y última fecha con ventas (para el rango "todo el historial").
create or replace function fn_rango_ventas()
returns table (primera date, ultima date)
language sql
stable
security definer
set search_path = public
as $$
  select min(fecha_local)::date, max(fecha_local)::date from fn_ventas_unificadas() where fn_tiene_permiso('modulo.reportes');
$$;

-- ---------------------------------------------------------------------------------------------
-- Clientes: resumen de compras y saldo, e historial de ventas de un cliente.
-- ---------------------------------------------------------------------------------------------

create or replace function fn_resumen_clientes()
returns table (cliente_id uuid, ventas bigint, total numeric, ultima_compra timestamp, saldo numeric)
language sql
stable
security definer
set search_path = public
as $$
  select u.cliente_id, count(*), sum(u.neto), max(u.fecha_local), sum(u.por_cobrar)
  from fn_ventas_unificadas() u
  where u.cliente_id is not null and (fn_tiene_permiso('modulo.clientes') or fn_tiene_permiso('modulo.reportes'))
  group by u.cliente_id;
$$;

create or replace function fn_ventas_cliente(p_cliente_id uuid)
returns table (
  origen text, referencia text, fecha timestamptz, estatus text, total numeric,
  pagado numeric, saldo numeric, nota text, venta_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (fn_tiene_permiso('modulo.clientes') or fn_tiene_permiso('modulo.reportes')) then
    raise exception 'No tienes permiso para ver las compras de los clientes';
  end if;
  return query
  select * from (
    select 'historica'::text, '#' || h.numero, h.fecha, h.estatus::text, h.total_actualizado,
           h.pago_efectivo + h.pago_tarjeta + h.pago_transferencia, h.saldo_pendiente, h.nota, null::uuid
    from ventas_historicas h where h.cliente_id = p_cliente_id
    union all
    select 'pos'::text, v.folio, v.created_at, v.estatus::text, v.total,
           coalesce((select sum(vp.monto) from venta_pagos vp where vp.venta_id = v.id), 0), 0::numeric, v.notas, v.id
    from ventas v where v.cliente_id = p_cliente_id
  ) t
  order by 3 desc
  limit 1000;
end;
$$;

grant execute on function fn_reporte_ventas(date, date, text) to authenticated;
grant execute on function fn_reporte_ventas_por(date, date, text, integer) to authenticated;
grant execute on function fn_rango_ventas() to authenticated;
grant execute on function fn_resumen_clientes() to authenticated;
grant execute on function fn_ventas_cliente(uuid) to authenticated;
