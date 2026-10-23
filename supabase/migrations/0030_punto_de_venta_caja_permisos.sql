-- Punto de venta, caja y permisos por usuario.
--
-- Diseño: el dinero y el inventario nunca se escriben desde la aplicación tabla por tabla.
-- Cada operación (vender, cancelar, abrir/cerrar caja, ingresos y retiros) es UNA función de
-- base de datos que valida el permiso de quien la llama, revisa existencias y totales, y escribe
-- todo en una sola transacción: o queda completa o no queda nada. Las tablas solo tienen
-- políticas de lectura; nadie puede insertar ni modificar ventas "a mano" con su sesión.

-- =========================================================
-- 1) Permisos por usuario
-- =========================================================
-- Lista de permisos de cada usuario (ver lib/permisos.ts para el catálogo). El rol 'admin' tiene
-- acceso completo siempre y no depende de esta lista.
alter table perfiles add column permisos text[] not null default '{}';

create or replace function fn_permisos_por_rol(p_rol rol_usuario)
returns text[]
language sql
immutable
as $$
  select case p_rol
    -- Los módulos que cada rol ya veía antes de esta migración (nadie pierde ni gana acceso a lo existente)
    -- más lo nuevo de punto de venta y caja.
    when 'ventas' then array[
      'modulo.dashboard','modulo.clientes','modulo.pedidos','modulo.compras','modulo.bordados','modulo.reportes',
      'modulo.pos','modulo.caja','pos.ver_ventas','caja.abrir_cerrar','caja.ingresos'
    ]
    when 'supervisor' then array[
      'modulo.dashboard','modulo.produccion','modulo.inventario','modulo.catalogos','modulo.materiales',
      'modulo.compras','modulo.bordados','modulo.reportes',
      'modulo.pos','modulo.caja','pos.ver_ventas','pos.descuentos','pos.cancelar',
      'caja.abrir_cerrar','caja.ingresos','caja.retiros'
    ]
    else array[]::text[]
  end;
$$;

-- Usuarios que ya existen: reciben los permisos de su rol.
update perfiles set permisos = fn_permisos_por_rol(rol) where rol <> 'admin';

-- Usuarios nuevos sin permisos explícitos: reciben los de su rol (así crearUsuario no cambia).
create or replace function fn_permisos_por_defecto()
returns trigger
language plpgsql
as $$
begin
  if cardinality(new.permisos) = 0 and new.rol <> 'admin' then
    new.permisos := fn_permisos_por_rol(new.rol);
  end if;
  return new;
end;
$$;

create trigger trg_permisos_por_defecto
  before insert on perfiles
  for each row execute function fn_permisos_por_defecto();

-- ¿Quien llama tiene este permiso? El administrador siempre; un usuario inactivo nunca.
create or replace function fn_tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select activo and (rol = 'admin' or p_permiso = any(permisos)) from perfiles where id = auth.uid()),
    false
  );
$$;

-- =========================================================
-- 2) Tablas
-- =========================================================
create type metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta');
create type estatus_venta as enum ('completada', 'cancelada');
create type tipo_movimiento_caja as enum ('ingreso', 'retiro');

-- Turno de caja: cada ubicación tiene su propia caja, con una sola abierta a la vez.
create table cajas_sesiones (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid not null references ubicaciones(id),
  abierta_por uuid not null references perfiles(id),
  fecha_apertura timestamptz not null default now(),
  fondo_inicial numeric(12,2) not null default 0 check (fondo_inicial >= 0),
  cerrada_por uuid references perfiles(id),
  fecha_cierre timestamptz,
  efectivo_esperado numeric(12,2),
  efectivo_contado numeric(12,2) check (efectivo_contado is null or efectivo_contado >= 0),
  notas_cierre text
);
create unique index cajas_sesiones_una_abierta_por_ubicacion on cajas_sesiones (ubicacion_id) where fecha_cierre is null;
create index idx_cajas_sesiones_apertura on cajas_sesiones (fecha_apertura desc);

create table caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references cajas_sesiones(id),
  tipo tipo_movimiento_caja not null,
  monto numeric(12,2) not null check (monto > 0),
  concepto text not null check (btrim(concepto) <> ''),
  registrado_por uuid not null references perfiles(id),
  created_at timestamptz not null default now()
);
create index idx_caja_movimientos_sesion on caja_movimientos (sesion_id);

create sequence ventas_folio_seq;

create table ventas (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  sesion_id uuid not null references cajas_sesiones(id),
  ubicacion_id uuid not null references ubicaciones(id),
  cliente_id uuid references clientes(id),
  vendedor_id uuid not null references perfiles(id),
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) not null default 0,
  estatus estatus_venta not null default 'completada',
  notas text,
  created_at timestamptz not null default now(),
  cancelada_por uuid references perfiles(id),
  fecha_cancelacion timestamptz,
  motivo_cancelacion text
);
create index idx_ventas_created_at on ventas (created_at desc);
create index idx_ventas_sesion on ventas (sesion_id);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  -- Nombre y talla tal como se vendieron: el ticket no cambia aunque después se renombre el producto.
  descripcion text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  importe numeric(12,2) not null
);
create index idx_venta_items_venta on venta_items (venta_id);

create table venta_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  metodo metodo_pago not null,
  -- Lo que se aplicó a la venta; la suma de los pagos es siempre igual al total.
  monto numeric(12,2) not null check (monto > 0),
  -- Solo efectivo: lo que entregó el cliente (>= monto); la diferencia es el cambio.
  recibido numeric(12,2),
  referencia text
);
create index idx_venta_pagos_venta on venta_pagos (venta_id);

-- =========================================================
-- 3) Seguridad: solo lectura con permiso; las escrituras van por las funciones
-- =========================================================
alter table cajas_sesiones enable row level security;
alter table caja_movimientos enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table venta_pagos enable row level security;

create policy "con_permiso_leen_cajas_sesiones" on cajas_sesiones for select
  using (fn_tiene_permiso('modulo.pos') or fn_tiene_permiso('modulo.caja'));
create policy "con_permiso_leen_caja_movimientos" on caja_movimientos for select
  using (fn_tiene_permiso('modulo.pos') or fn_tiene_permiso('modulo.caja'));
create policy "con_permiso_leen_ventas" on ventas for select
  using (fn_tiene_permiso('modulo.pos') or fn_tiene_permiso('modulo.caja'));
create policy "con_permiso_leen_venta_items" on venta_items for select
  using (fn_tiene_permiso('modulo.pos') or fn_tiene_permiso('modulo.caja'));
create policy "con_permiso_leen_venta_pagos" on venta_pagos for select
  using (fn_tiene_permiso('modulo.pos') or fn_tiene_permiso('modulo.caja'));

-- =========================================================
-- 4) Operaciones
-- =========================================================

-- Efectivo que debe haber en el cajón: fondo + ventas en efectivo + ingresos - retiros.
-- Las ventas canceladas no cuentan.
create or replace function fn_efectivo_esperado(p_sesion_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select s.fondo_inicial
    + coalesce((select sum(p.monto) from venta_pagos p join ventas v on v.id = p.venta_id
                where v.sesion_id = s.id and v.estatus = 'completada' and p.metodo = 'efectivo'), 0)
    + coalesce((select sum(m.monto) from caja_movimientos m where m.sesion_id = s.id and m.tipo = 'ingreso'), 0)
    - coalesce((select sum(m.monto) from caja_movimientos m where m.sesion_id = s.id and m.tipo = 'retiro'), 0)
  from cajas_sesiones s
  where s.id = p_sesion_id;
$$;

create or replace function fn_abrir_caja(p_ubicacion_id uuid, p_fondo_inicial numeric default 0)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
begin
  if not fn_tiene_permiso('caja.abrir_cerrar') then
    raise exception 'No tienes permiso para abrir la caja';
  end if;
  select nombre into v_nombre from ubicaciones where id = p_ubicacion_id and activa;
  if v_nombre is null then raise exception 'Ubicación inválida'; end if;
  if coalesce(p_fondo_inicial, 0) < 0 then raise exception 'El fondo inicial no puede ser negativo'; end if;

  insert into cajas_sesiones (ubicacion_id, abierta_por, fondo_inicial)
  values (p_ubicacion_id, auth.uid(), coalesce(p_fondo_inicial, 0))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya hay una caja abierta en %', v_nombre;
end;
$$;

create or replace function fn_registrar_movimiento_caja(
  p_sesion_id uuid,
  p_tipo tipo_movimiento_caja,
  p_monto numeric,
  p_concepto text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_efectivo numeric;
begin
  if p_tipo = 'ingreso' and not fn_tiene_permiso('caja.ingresos') then
    raise exception 'No tienes permiso para registrar ingresos de caja';
  end if;
  if p_tipo = 'retiro' and not fn_tiene_permiso('caja.retiros') then
    raise exception 'No tienes permiso para registrar retiros de caja';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a cero'; end if;
  if p_concepto is null or btrim(p_concepto) = '' then raise exception 'Escribe el motivo del movimiento'; end if;

  perform 1 from cajas_sesiones where id = p_sesion_id and fecha_cierre is null for update;
  if not found then raise exception 'La caja ya está cerrada o no existe'; end if;

  if p_tipo = 'retiro' then
    v_efectivo := fn_efectivo_esperado(p_sesion_id);
    if p_monto > v_efectivo then
      raise exception 'No hay suficiente efectivo en caja: hay $%', to_char(v_efectivo, 'FM999,999,990.00');
    end if;
  end if;

  insert into caja_movimientos (sesion_id, tipo, monto, concepto, registrado_por)
  values (p_sesion_id, p_tipo, p_monto, btrim(p_concepto), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Cierra el turno comparando lo contado contra lo esperado. Devuelve la diferencia (contado - esperado):
-- negativa = faltante, positiva = sobrante.
create or replace function fn_cerrar_caja(p_sesion_id uuid, p_efectivo_contado numeric, p_notas text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado numeric;
begin
  if not fn_tiene_permiso('caja.abrir_cerrar') then
    raise exception 'No tienes permiso para cerrar la caja';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Cuenta el efectivo del cajón e ingresa la cantidad (puede ser 0)';
  end if;

  perform 1 from cajas_sesiones where id = p_sesion_id and fecha_cierre is null for update;
  if not found then raise exception 'La caja ya está cerrada o no existe'; end if;

  v_esperado := fn_efectivo_esperado(p_sesion_id);
  update cajas_sesiones
    set cerrada_por = auth.uid(),
        fecha_cierre = now(),
        efectivo_esperado = v_esperado,
        efectivo_contado = p_efectivo_contado,
        notas_cierre = nullif(btrim(p_notas), '')
    where id = p_sesion_id;
  return p_efectivo_contado - v_esperado;
end;
$$;

-- Registra una venta completa: valida permisos, caja abierta, existencias y pagos; descuenta el
-- inventario de la ubicación y deja todo en la misma transacción.
--   p_items: [{"modelo_id": uuid, "talla_id": uuid, "cantidad": n}, ...]
--   p_pagos: [{"metodo": "efectivo"|"transferencia"|"tarjeta", "monto": n, "recibido": n?, "referencia": text?}, ...]
-- Los precios se toman SIEMPRE de la base (nunca del cliente).
create or replace function fn_registrar_venta(
  p_ubicacion_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_descuento numeric default 0,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sesion uuid;
  v_ubicacion text;
  v_venta uuid := gen_random_uuid();
  v_folio text;
  v_linea record;
  v_pago record;
  v_nombre text;
  v_talla text;
  v_precio numeric;
  v_disponible integer;
  v_subtotal numeric(12,2) := 0;
  v_descuento numeric(12,2) := coalesce(p_descuento, 0);
  v_total numeric(12,2);
  v_pagado numeric(12,2) := 0;
  v_importe numeric(12,2);
begin
  if v_uid is null or not fn_tiene_permiso('modulo.pos') then
    raise exception 'No tienes permiso para vender';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto a la venta';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where coalesce(e->>'cantidad', '') !~ '^[0-9]+$' or (e->>'cantidad')::int < 1
       or coalesce(e->>'modelo_id', '') = '' or coalesce(e->>'talla_id', '') = ''
  ) then
    raise exception 'La lista de productos tiene datos inválidos';
  end if;
  if v_descuento < 0 then raise exception 'El descuento no puede ser negativo'; end if;
  if v_descuento > 0 and not fn_tiene_permiso('pos.descuentos') then
    raise exception 'No tienes permiso para aplicar descuentos';
  end if;

  select nombre into v_ubicacion from ubicaciones where id = p_ubicacion_id and activa;
  if v_ubicacion is null then raise exception 'Ubicación inválida'; end if;
  select id into v_sesion from cajas_sesiones where ubicacion_id = p_ubicacion_id and fecha_cierre is null;
  if v_sesion is null then
    raise exception 'No hay una caja abierta en %. Ábrela en Caja antes de vender.', v_ubicacion;
  end if;

  v_folio := 'VTA-' || lpad(nextval('ventas_folio_seq')::text, 6, '0');
  insert into ventas (id, folio, sesion_id, ubicacion_id, cliente_id, vendedor_id, notas)
  values (v_venta, v_folio, v_sesion, p_ubicacion_id, p_cliente_id, v_uid, nullif(btrim(p_notas), ''));

  -- Una línea por producto y talla (se juntan repetidas) y siempre en el mismo orden, para que dos
  -- ventas simultáneas bloqueen las existencias en el mismo orden y no se atoren entre sí.
  for v_linea in
    select (e->>'modelo_id')::uuid as modelo_id, (e->>'talla_id')::uuid as talla_id, sum((e->>'cantidad')::int)::int as cantidad
    from jsonb_array_elements(p_items) e
    group by 1, 2
    order by 1, 2
  loop
    select m.nombre, coalesce(mt.precio_venta, m.precio_venta), t.codigo
      into v_nombre, v_precio, v_talla
      from modelos m
      join tallas t on t.id = v_linea.talla_id
      left join modelo_tallas mt on mt.modelo_id = m.id and mt.talla_id = t.id
      where m.id = v_linea.modelo_id;
    if v_nombre is null then raise exception 'Producto o talla inválidos'; end if;
    if v_precio is null or v_precio <= 0 then
      raise exception 'El producto "%" no tiene precio de venta', v_nombre;
    end if;

    select cantidad_actual into v_disponible
      from stock_productos
      where modelo_id = v_linea.modelo_id and talla_id = v_linea.talla_id and ubicacion_id = p_ubicacion_id
      for update;
    v_disponible := coalesce(v_disponible, 0);
    if v_disponible < v_linea.cantidad and not fn_tiene_permiso('pos.sin_existencias') then
      raise exception 'No hay suficientes existencias de "%" (talla %) en %: disponibles %, pedidas %',
        v_nombre, v_talla, v_ubicacion, v_disponible, v_linea.cantidad;
    end if;

    v_importe := round(v_precio * v_linea.cantidad, 2);
    insert into venta_items (venta_id, modelo_id, talla_id, descripcion, cantidad, precio_unitario, importe)
    values (
      v_venta, v_linea.modelo_id, v_linea.talla_id,
      v_nombre || case when upper(btrim(v_talla)) = 'UNITALLA' then '' else ' / ' || btrim(v_talla) end,
      v_linea.cantidad, v_precio, v_importe
    );
    v_subtotal := v_subtotal + v_importe;

    insert into movimientos_stock_producto (modelo_id, talla_id, ubicacion_id, tipo, cantidad, motivo, registrado_por)
    values (v_linea.modelo_id, v_linea.talla_id, p_ubicacion_id, 'salida', v_linea.cantidad, 'Venta ' || v_folio, v_uid);
  end loop;

  if v_descuento > v_subtotal then raise exception 'El descuento no puede ser mayor al subtotal'; end if;
  v_total := v_subtotal - v_descuento;
  if v_total <= 0 then raise exception 'El total de la venta debe ser mayor a cero'; end if;

  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Indica cómo se pagó la venta';
  end if;
  for v_pago in
    select e->>'metodo' as metodo, (e->>'monto')::numeric as monto, (e->>'recibido')::numeric as recibido, nullif(btrim(e->>'referencia'), '') as referencia
    from jsonb_array_elements(p_pagos) e
  loop
    if v_pago.monto is null or v_pago.monto <= 0 then raise exception 'Cada pago debe ser mayor a cero'; end if;
    if v_pago.metodo = 'efectivo' and v_pago.recibido is not null and v_pago.recibido < v_pago.monto then
      raise exception 'El efectivo recibido ($%) es menor al monto cobrado ($%)', v_pago.recibido, v_pago.monto;
    end if;
    insert into venta_pagos (venta_id, metodo, monto, recibido, referencia)
    values (
      v_venta, v_pago.metodo::metodo_pago, round(v_pago.monto, 2),
      case when v_pago.metodo = 'efectivo' then round(coalesce(v_pago.recibido, v_pago.monto), 2) end,
      v_pago.referencia
    );
    v_pagado := v_pagado + round(v_pago.monto, 2);
  end loop;
  if v_pagado <> v_total then
    raise exception 'Los pagos ($%) no coinciden con el total de la venta ($%)',
      to_char(v_pagado, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00');
  end if;

  update ventas set subtotal = v_subtotal, descuento = v_descuento, total = v_total where id = v_venta;
  return v_venta;
end;
$$;

-- Cancela una venta de un turno todavía abierto y regresa las piezas al inventario.
-- Con la caja ya cerrada no se puede cancelar: cambiaría un corte que ya se entregó.
create or replace function fn_cancelar_venta(p_venta_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta ventas%rowtype;
  v_item record;
begin
  if not fn_tiene_permiso('pos.cancelar') then
    raise exception 'No tienes permiso para cancelar ventas';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'Escribe el motivo de la cancelación'; end if;

  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_venta.estatus = 'cancelada' then raise exception 'Esa venta ya estaba cancelada'; end if;
  perform 1 from cajas_sesiones where id = v_venta.sesion_id and fecha_cierre is null;
  if not found then
    raise exception 'La caja de esa venta ya se cerró; no se puede cancelar.';
  end if;

  for v_item in select modelo_id, talla_id, cantidad from venta_items where venta_id = p_venta_id order by modelo_id, talla_id loop
    insert into movimientos_stock_producto (modelo_id, talla_id, ubicacion_id, tipo, cantidad, motivo, registrado_por)
    values (v_item.modelo_id, v_item.talla_id, v_venta.ubicacion_id, 'entrada', v_item.cantidad,
            'Cancelación de ' || v_venta.folio, auth.uid());
  end loop;

  update ventas
    set estatus = 'cancelada', cancelada_por = auth.uid(), fecha_cancelacion = now(), motivo_cancelacion = btrim(p_motivo)
    where id = p_venta_id;
end;
$$;
