-- Producción simplificada: órdenes internas o de maquila, entregas parciales por talla y pagos a maquileros.
--
-- Se ELIMINA por completo el seguimiento por etapas/procesos (etapas, avance por colaborador, funciones del
-- colaborador). El producto terminado ahora entra a inventario al registrar cada entrega, y la orden pasa sola a
-- "terminada" (se muestra como "Completa") cuando todo está entregado. Una orden se puede cerrar a mano con
-- faltantes. Una entrega de maquila genera su pago (piezas × precio por pieza del modelo en la orden).
--
-- Lo que NO cambia: materia prima y rollos con QR (cuelgan de la orden, no de las etapas), inventario, clientes,
-- pedidos, ventas y caja. Las órdenes que ya existen se conservan y regresan a "planeada".

-- =============================================================================================
-- 1) Eliminar etapas y avance (en el orden que exigen las llaves foráneas)
-- =============================================================================================
drop table registros_avance_colaborador;                 -- también quita su trigger, políticas e índices
drop function fn_validar_y_acumular_avance();            -- ya no hay trigger que la llame
alter table incidencias_produccion drop column lote_etapa_id;
drop table lote_etapas;
drop table colaborador_etapas;
drop table etapas_proceso;
drop type origen_avance;

-- Políticas del bucket de evidencias de avance. El bucket "evidencia-avance" se vacía y se borra desde el panel de
-- Supabase (Storage): SQL no puede borrar un bucket que tiene archivos.
drop policy if exists "autenticados_suben_evidencia_avance" on storage.objects;
drop policy if exists "autenticados_leen_evidencia_avance" on storage.objects;

-- =============================================================================================
-- 2) Maquileros
-- =============================================================================================
create table maquileros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index maquileros_nombre_unico on maquileros (lower(btrim(nombre)));

-- Banco y CLABE aparte: solo quien ve los pagos puede leerlos (el resto del equipo de producción no).
create table maquileros_datos_bancarios (
  maquilero_id uuid primary key references maquileros(id) on delete cascade,
  banco text,
  clabe text check (clabe is null or clabe ~ '^[0-9]{18}$')
);

-- =============================================================================================
-- 3) Órdenes: tipo (interna / maquila), maquilero, precio por pieza por modelo y cierre manual
-- =============================================================================================
alter table lotes_produccion
  add column tipo_produccion text not null default 'interna' check (tipo_produccion in ('interna', 'maquila')),
  add column maquilero_id uuid references maquileros(id),
  add column cerrada_con_faltantes boolean not null default false,
  add column motivo_cierre text,
  add column fecha_cierre timestamptz,
  add constraint lotes_tipo_maquilero check (
    (tipo_produccion = 'interna' and maquilero_id is null) or (tipo_produccion = 'maquila' and maquilero_id is not null)
  );
create index idx_lotes_maquilero on lotes_produccion (maquilero_id) where maquilero_id is not null;

-- Un precio por MODELO dentro de la orden (igual para todas sus tallas). Es un monto: solo lo ve y edita quien
-- tiene el permiso de pagos de maquila.
create table precios_maquila_orden (
  lote_id uuid not null references lotes_produccion(id) on delete cascade,
  modelo_id uuid not null references modelos(id),
  precio_por_pieza numeric(12,2) not null check (precio_por_pieza >= 0),
  primary key (lote_id, modelo_id)
);

-- =============================================================================================
-- 4) Entregas y pagos
-- =============================================================================================
create table entregas_produccion (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id),
  fecha date not null,
  tipo_produccion text not null check (tipo_produccion in ('interna', 'maquila')),
  entregado_por uuid references perfiles(id),             -- interna: colaborador del taller que entrega
  maquilero_id uuid references maquileros(id),            -- maquila: quién entrega
  recibido_por uuid not null references perfiles(id),     -- quién recibe de nuestro lado
  ubicacion_id uuid not null references ubicaciones(id),  -- a dónde entraron las piezas
  fecha_pago date,                                         -- maquila: cuándo se le va a pagar
  notas text,
  estatus text not null default 'registrada' check (estatus in ('registrada', 'cancelada')),
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  cancelada_por uuid references perfiles(id),
  fecha_cancelacion timestamptz,
  motivo_cancelacion text,
  constraint entrega_interna_o_maquila check (
    (tipo_produccion = 'interna' and entregado_por is not null and maquilero_id is null and fecha_pago is null)
    or (tipo_produccion = 'maquila' and maquilero_id is not null and entregado_por is null and fecha_pago is not null)
  )
);
create index idx_entregas_produccion_lote on entregas_produccion (lote_id);
create index idx_entregas_produccion_fecha on entregas_produccion (fecha);
create index idx_entregas_produccion_maquilero on entregas_produccion (maquilero_id) where maquilero_id is not null;

create table entrega_produccion_items (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references entregas_produccion(id) on delete cascade,
  item_orden_id uuid not null references items_orden_produccion(id) on delete cascade,  -- modelo + talla de la orden
  cantidad integer not null check (cantidad > 0),
  unique (entrega_id, item_orden_id)
);
create index idx_entrega_items_item on entrega_produccion_items (item_orden_id);

create table pagos_maquila (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null unique references entregas_produccion(id),
  maquilero_id uuid not null references maquileros(id),
  monto numeric(12,2) not null check (monto >= 0),         -- piezas × precio vigente al registrar la entrega
  fecha_programada date not null,
  estatus text not null default 'pendiente' check (estatus in ('pendiente', 'pagado', 'cancelado')),
  fecha_pago_real date,
  pagado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  constraint pago_fecha_real check ((estatus = 'pagado') = (fecha_pago_real is not null))
);
create index idx_pagos_maquila_maquilero on pagos_maquila (maquilero_id);
create index idx_pagos_maquila_pendientes on pagos_maquila (fecha_programada) where estatus = 'pendiente';

-- =============================================================================================
-- 5) Seguridad: lectura por permiso; todo lo que escribe dinero o inventario pasa por funciones
-- =============================================================================================
alter table maquileros enable row level security;
alter table maquileros_datos_bancarios enable row level security;
alter table precios_maquila_orden enable row level security;
alter table entregas_produccion enable row level security;
alter table entrega_produccion_items enable row level security;
alter table pagos_maquila enable row level security;

create policy "produccion_gestiona_maquileros" on maquileros for all
  using (fn_tiene_permiso('modulo.produccion')) with check (fn_tiene_permiso('modulo.produccion'));
create policy "pagos_gestionan_datos_bancarios" on maquileros_datos_bancarios for all
  using (fn_tiene_permiso('produccion.pagos_maquila')) with check (fn_tiene_permiso('produccion.pagos_maquila'));
create policy "pagos_gestionan_precios_maquila" on precios_maquila_orden for all
  using (fn_tiene_permiso('produccion.pagos_maquila')) with check (fn_tiene_permiso('produccion.pagos_maquila'));
create policy "produccion_lee_entregas" on entregas_produccion for select using (fn_tiene_permiso('modulo.produccion'));
create policy "produccion_lee_entrega_items" on entrega_produccion_items for select using (fn_tiene_permiso('modulo.produccion'));
create policy "pagos_leen_pagos_maquila" on pagos_maquila for select using (fn_tiene_permiso('produccion.pagos_maquila'));

-- =============================================================================================
-- 6) Reglas de integridad de las órdenes
-- =============================================================================================
-- Piezas ya entregadas (entregas vigentes) de un renglón de la orden.
create or replace function fn_entregado_item(p_item_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.cantidad), 0)::int
  from entrega_produccion_items i
  join entregas_produccion e on e.id = i.entrega_id
  where i.item_orden_id = p_item_id and e.estatus = 'registrada';
$$;
revoke all on function fn_entregado_item(uuid) from public, anon;

-- El tipo de producción y el maquilero solo se cambian mientras la orden no tenga entregas vigentes.
create or replace function fn_proteger_tipo_orden()
returns trigger
language plpgsql
as $$
begin
  if (new.tipo_produccion is distinct from old.tipo_produccion or new.maquilero_id is distinct from old.maquilero_id)
     and exists (select 1 from entregas_produccion where lote_id = old.id and estatus = 'registrada') then
    raise exception 'No se puede cambiar el tipo de producción ni el maquilero de una orden que ya tiene entregas';
  end if;
  return new;
end;
$$;
create trigger trg_proteger_tipo_orden before update on lotes_produccion
  for each row execute function fn_proteger_tipo_orden();

-- La cantidad pedida de un renglón no puede bajar de lo ya entregado, ni borrarse si ya tiene entregas.
create or replace function fn_proteger_items_orden()
returns trigger
language plpgsql
as $$
declare
  v_entregado integer;
begin
  v_entregado := fn_entregado_item(old.id);
  if tg_op = 'DELETE' then
    if v_entregado > 0 then
      raise exception 'No se puede quitar un producto que ya tiene % pieza(s) entregada(s)', v_entregado;
    end if;
    return old;
  end if;
  if new.cantidad_planeada < v_entregado then
    raise exception 'La cantidad no puede ser menor a lo ya entregado (% pieza(s))', v_entregado;
  end if;
  return new;
end;
$$;
create trigger trg_proteger_items_orden before update of cantidad_planeada or delete on items_orden_produccion
  for each row execute function fn_proteger_items_orden();

-- =============================================================================================
-- 7) Estado de la orden y del pedido
-- =============================================================================================
-- El pedido sigue a sus órdenes: listo cuando todas terminaron, en producción mientras alguna avanza.
create or replace function fn_reevaluar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estatus text;
  v_total integer;
  v_finalizadas integer;
  v_terminadas integer;
  v_avanzadas integer;
begin
  select estatus::text into v_estatus from pedidos where id = p_pedido_id;
  if v_estatus is null or v_estatus not in ('confirmado', 'en_produccion', 'listo') then return; end if;

  select count(*), count(*) filter (where estatus in ('terminada', 'cancelada')),
         count(*) filter (where estatus = 'terminada'), count(*) filter (where estatus in ('en_proceso', 'terminada'))
    into v_total, v_finalizadas, v_terminadas, v_avanzadas
    from lotes_produccion where pedido_id = p_pedido_id;
  if v_total = 0 then return; end if;

  if v_finalizadas = v_total then
    if v_terminadas > 0 then
      update pedidos set estatus = 'listo' where id = p_pedido_id and estatus in ('confirmado', 'en_produccion');
    else
      update pedidos set estatus = 'confirmado' where id = p_pedido_id and estatus in ('en_produccion', 'listo');
    end if;
  elsif v_avanzadas > 0 then
    update pedidos set estatus = 'en_produccion' where id = p_pedido_id and estatus in ('confirmado', 'listo');
  else
    update pedidos set estatus = 'confirmado' where id = p_pedido_id and estatus in ('en_produccion', 'listo');
  end if;
end;
$$;
revoke all on function fn_reevaluar_pedido(uuid) from public, anon;

-- Recalcula el estatus de una orden según lo entregado: sin entregas = planeada, con entregas = en proceso, todo
-- entregado = terminada (completa). Una orden cerrada a mano con faltantes o cancelada no se toca.
create or replace function fn_recalcular_estado_orden(p_lote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote lotes_produccion%rowtype;
  v_items integer;
  v_incompletos integer;
  v_con_entrega integer;
  v_hoy date := ((now() at time zone 'UTC') - interval '6 hours')::date;
begin
  if not fn_tiene_permiso('modulo.produccion') then
    raise exception 'No tienes permiso para modificar órdenes de producción';
  end if;
  select * into v_lote from lotes_produccion where id = p_lote_id for update;
  if not found then raise exception 'La orden no existe'; end if;
  if v_lote.estatus = 'cancelada' or v_lote.cerrada_con_faltantes then
    if v_lote.pedido_id is not null then perform fn_reevaluar_pedido(v_lote.pedido_id); end if;
    return;
  end if;

  select count(*),
         count(*) filter (where fn_entregado_item(i.id) < i.cantidad_planeada),
         count(*) filter (where fn_entregado_item(i.id) > 0)
    into v_items, v_incompletos, v_con_entrega
    from items_orden_produccion i where i.lote_id = p_lote_id;

  if v_items > 0 and v_incompletos = 0 then
    update lotes_produccion set estatus = 'terminada', fecha_fin_real = coalesce(fecha_fin_real, v_hoy) where id = p_lote_id;
  elsif v_con_entrega > 0 then
    update lotes_produccion set estatus = 'en_proceso', fecha_fin_real = null where id = p_lote_id;
  else
    update lotes_produccion set estatus = 'planeada', fecha_fin_real = null where id = p_lote_id;
  end if;

  if v_lote.pedido_id is not null then perform fn_reevaluar_pedido(v_lote.pedido_id); end if;
end;
$$;

-- =============================================================================================
-- 8) Registrar, cancelar y cerrar
-- =============================================================================================
create or replace function fn_registrar_entrega_produccion(
  p_lote_id uuid,
  p_fecha date,
  p_entregado_por uuid,
  p_recibido_por uuid,
  p_fecha_pago date,
  p_notas text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lote lotes_produccion%rowtype;
  v_hoy date := ((now() at time zone 'UTC') - interval '6 hours')::date;
  v_entrega uuid := gen_random_uuid();
  v_ubicacion uuid;
  v_linea record;
  v_modelo uuid;
  v_talla uuid;
  v_nombre text;
  v_codigo text;
  v_planeada integer;
  v_pendiente integer;
  v_precio numeric;
  v_monto numeric(12,2) := 0;
  v_fecha_pago date;
begin
  if v_uid is null or not fn_tiene_permiso('modulo.produccion') then
    raise exception 'No tienes permiso para registrar entregas';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Captura al menos una cantidad entregada';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where coalesce(e->>'item_orden_id', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(e->>'cantidad', '') !~ '^[0-9]{1,6}$' or (case when coalesce(e->>'cantidad', '') ~ '^[0-9]{1,6}$' then (e->>'cantidad')::int else 0 end) < 1
  ) then
    raise exception 'La lista de cantidades entregadas tiene datos inválidos';
  end if;
  if p_fecha is null then raise exception 'Indica la fecha de la entrega'; end if;
  if p_fecha > v_hoy then raise exception 'La fecha de la entrega no puede ser futura'; end if;

  select * into v_lote from lotes_produccion where id = p_lote_id for update;
  if not found then raise exception 'La orden no existe'; end if;
  if v_lote.estatus = 'cancelada' then raise exception 'La orden % está cancelada', v_lote.folio; end if;
  if v_lote.estatus = 'terminada' then
    raise exception 'La orden % ya está completa. Si hubo piezas de más, aumenta primero la cantidad de la orden', v_lote.folio;
  end if;

  perform 1 from perfiles where id = p_recibido_por and activo;
  if not found then raise exception 'Elige quién recibe las piezas'; end if;

  if v_lote.tipo_produccion = 'interna' then
    perform 1 from perfiles where id = p_entregado_por and activo;
    if not found then raise exception 'Elige quién entrega las piezas'; end if;
  else
    perform 1 from maquileros where id = v_lote.maquilero_id and activo;
    if not found then raise exception 'El maquilero de esta orden está inactivo'; end if;
    v_fecha_pago := coalesce(p_fecha_pago, p_fecha + 15);
    if v_fecha_pago < p_fecha then raise exception 'La fecha de pago no puede ser anterior a la entrega'; end if;
  end if;

  v_ubicacion := coalesce(v_lote.ubicacion_destino_id, fn_ubicacion_predeterminada());

  insert into entregas_produccion (id, lote_id, fecha, tipo_produccion, entregado_por, maquilero_id, recibido_por, ubicacion_id, fecha_pago, notas, registrado_por)
  values (v_entrega, p_lote_id, p_fecha, v_lote.tipo_produccion,
          case when v_lote.tipo_produccion = 'interna' then p_entregado_por end,
          case when v_lote.tipo_produccion = 'maquila' then v_lote.maquilero_id end,
          p_recibido_por, v_ubicacion, v_fecha_pago, nullif(btrim(p_notas), ''), v_uid);

  -- Un renglón por producto y talla (se juntan repetidos), siempre en el mismo orden para no atorar entregas simultáneas.
  for v_linea in
    select (e->>'item_orden_id')::uuid as item_id, sum((e->>'cantidad')::int)::int as cantidad
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select i.modelo_id, i.talla_id, i.cantidad_planeada, m.nombre, t.codigo
      into v_modelo, v_talla, v_planeada, v_nombre, v_codigo
      from items_orden_produccion i
      join modelos m on m.id = i.modelo_id
      join tallas t on t.id = i.talla_id
      where i.id = v_linea.item_id and i.lote_id = p_lote_id
      for update of i;
    if not found then raise exception 'Uno de los productos no pertenece a esta orden'; end if;

    v_pendiente := v_planeada - fn_entregado_item(v_linea.item_id);
    if v_linea.cantidad > v_pendiente then
      raise exception 'No puedes entregar % de "%" talla %: solo faltan % de % pedidas. Si entregaron de más, aumenta primero la cantidad de la orden',
        v_linea.cantidad, v_nombre, v_codigo, greatest(v_pendiente, 0), v_planeada;
    end if;

    insert into entrega_produccion_items (entrega_id, item_orden_id, cantidad) values (v_entrega, v_linea.item_id, v_linea.cantidad);

    insert into movimientos_stock_producto (modelo_id, talla_id, ubicacion_id, tipo, cantidad, orden_produccion_id, motivo, registrado_por)
    values (v_modelo, v_talla, v_ubicacion, 'entrada', v_linea.cantidad, p_lote_id, 'Entrega de producción ' || v_lote.folio, v_uid);

    if v_lote.tipo_produccion = 'maquila' then
      select precio_por_pieza into v_precio from precios_maquila_orden where lote_id = p_lote_id and modelo_id = v_modelo;
      if v_precio is null then
        raise exception 'Falta el precio por pieza de "%" en la orden %. Pídele al administrador que lo capture', v_nombre, v_lote.folio;
      end if;
      v_monto := v_monto + round(v_precio * v_linea.cantidad, 2);
    end if;
  end loop;

  if v_lote.tipo_produccion = 'maquila' then
    insert into pagos_maquila (entrega_id, maquilero_id, monto, fecha_programada) values (v_entrega, v_lote.maquilero_id, v_monto, v_fecha_pago);
  end if;

  perform fn_recalcular_estado_orden(p_lote_id);
  return v_entrega;
end;
$$;

create or replace function fn_cancelar_entrega_produccion(p_entrega_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega entregas_produccion%rowtype;
  v_pago pagos_maquila%rowtype;
  v_linea record;
  v_disponible integer;
  v_folio text;
begin
  if not fn_tiene_permiso('modulo.produccion') then
    raise exception 'No tienes permiso para cancelar entregas';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'Escribe el motivo de la cancelación'; end if;

  select * into v_entrega from entregas_produccion where id = p_entrega_id for update;
  if not found then raise exception 'La entrega no existe'; end if;
  if v_entrega.estatus = 'cancelada' then raise exception 'Esa entrega ya estaba cancelada'; end if;

  perform 1 from lotes_produccion where id = v_entrega.lote_id for update;
  select folio into v_folio from lotes_produccion where id = v_entrega.lote_id;

  select * into v_pago from pagos_maquila where entrega_id = p_entrega_id for update;
  if found and v_pago.estatus = 'pagado' then
    raise exception 'No se puede cancelar: el pago de esta entrega ya está marcado como pagado. Desmárcalo primero en Pagos';
  end if;

  for v_linea in
    select i.modelo_id, i.talla_id, ei.cantidad, m.nombre, t.codigo
      from entrega_produccion_items ei
      join items_orden_produccion i on i.id = ei.item_orden_id
      join modelos m on m.id = i.modelo_id
      join tallas t on t.id = i.talla_id
      where ei.entrega_id = p_entrega_id
      order by i.modelo_id, i.talla_id
  loop
    select cantidad_actual into v_disponible from stock_productos
      where modelo_id = v_linea.modelo_id and talla_id = v_linea.talla_id and ubicacion_id = v_entrega.ubicacion_id for update;
    if coalesce(v_disponible, 0) < v_linea.cantidad then
      raise exception 'No se puede cancelar: de "%" talla % ya salieron piezas del inventario (hay %, esta entrega aportó %)',
        v_linea.nombre, v_linea.codigo, coalesce(v_disponible, 0), v_linea.cantidad;
    end if;
    insert into movimientos_stock_producto (modelo_id, talla_id, ubicacion_id, tipo, cantidad, orden_produccion_id, motivo, registrado_por)
    values (v_linea.modelo_id, v_linea.talla_id, v_entrega.ubicacion_id, 'salida', v_linea.cantidad, v_entrega.lote_id,
            'Cancelación de entrega de ' || v_folio, auth.uid());
  end loop;

  update entregas_produccion
    set estatus = 'cancelada', cancelada_por = auth.uid(), fecha_cancelacion = now(), motivo_cancelacion = btrim(p_motivo)
    where id = p_entrega_id;
  update pagos_maquila set estatus = 'cancelado' where entrega_id = p_entrega_id;

  perform fn_recalcular_estado_orden(v_entrega.lote_id);
end;
$$;

-- Cierra la orden aunque falten piezas (el maquilero o el taller no van a terminar). Necesita al menos una entrega.
create or replace function fn_cerrar_orden_produccion(p_lote_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote lotes_produccion%rowtype;
begin
  if not fn_tiene_permiso('modulo.produccion') then
    raise exception 'No tienes permiso para cerrar órdenes';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'Escribe por qué se cierra con faltantes'; end if;
  select * into v_lote from lotes_produccion where id = p_lote_id for update;
  if not found then raise exception 'La orden no existe'; end if;
  if v_lote.estatus = 'cancelada' then raise exception 'La orden está cancelada'; end if;
  if v_lote.estatus = 'terminada' then raise exception 'La orden ya está completa'; end if;
  if not exists (select 1 from entregas_produccion where lote_id = p_lote_id and estatus = 'registrada') then
    raise exception 'Registra al menos una entrega antes de cerrar la orden con faltantes (si no se va a producir, cancélala)';
  end if;

  update lotes_produccion
    set estatus = 'terminada', cerrada_con_faltantes = true, motivo_cierre = btrim(p_motivo), fecha_cierre = now(),
        fecha_fin_real = ((now() at time zone 'UTC') - interval '6 hours')::date
    where id = p_lote_id;
  if v_lote.pedido_id is not null then perform fn_reevaluar_pedido(v_lote.pedido_id); end if;
end;
$$;

create or replace function fn_reabrir_orden_produccion(p_lote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote lotes_produccion%rowtype;
begin
  if not fn_tiene_permiso('modulo.produccion') then
    raise exception 'No tienes permiso para reabrir órdenes';
  end if;
  select * into v_lote from lotes_produccion where id = p_lote_id for update;
  if not found then raise exception 'La orden no existe'; end if;
  if not v_lote.cerrada_con_faltantes then raise exception 'Solo se reabre una orden que se cerró con faltantes'; end if;
  update lotes_produccion set cerrada_con_faltantes = false, motivo_cierre = null, fecha_cierre = null where id = p_lote_id;
  perform fn_recalcular_estado_orden(p_lote_id);
end;
$$;

-- Marca un pago como pagado (con la fecha real) o lo regresa a pendiente.
create or replace function fn_marcar_pago_maquila(p_pago_id uuid, p_pagado boolean, p_fecha date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago pagos_maquila%rowtype;
  v_hoy date := ((now() at time zone 'UTC') - interval '6 hours')::date;
begin
  if not fn_tiene_permiso('produccion.pagos_maquila') then
    raise exception 'No tienes permiso para marcar pagos de maquila';
  end if;
  select * into v_pago from pagos_maquila where id = p_pago_id for update;
  if not found then raise exception 'El pago no existe'; end if;
  if v_pago.estatus = 'cancelado' then raise exception 'Ese pago está cancelado (su entrega se canceló)'; end if;
  if p_pagado then
    if p_fecha is not null and p_fecha > v_hoy then raise exception 'La fecha de pago no puede ser futura'; end if;
    update pagos_maquila set estatus = 'pagado', fecha_pago_real = coalesce(p_fecha, v_hoy), pagado_por = auth.uid() where id = p_pago_id;
  else
    update pagos_maquila set estatus = 'pendiente', fecha_pago_real = null, pagado_por = null where id = p_pago_id;
  end if;
end;
$$;

-- Cambia la fecha en que se va a pagar (si hubo acuerdo distinto).
create or replace function fn_reprogramar_pago_maquila(p_pago_id uuid, p_fecha date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fn_tiene_permiso('produccion.pagos_maquila') then
    raise exception 'No tienes permiso para cambiar pagos de maquila';
  end if;
  if p_fecha is null then raise exception 'Indica la nueva fecha de pago'; end if;
  update pagos_maquila set fecha_programada = p_fecha where id = p_pago_id and estatus = 'pendiente';
  if not found then raise exception 'Solo se puede reprogramar un pago pendiente'; end if;
  update entregas_produccion set fecha_pago = p_fecha where id = (select entrega_id from pagos_maquila where id = p_pago_id);
end;
$$;

grant execute on function fn_registrar_entrega_produccion(uuid, date, uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function fn_cancelar_entrega_produccion(uuid, text) to authenticated;
grant execute on function fn_cerrar_orden_produccion(uuid, text) to authenticated;
grant execute on function fn_reabrir_orden_produccion(uuid) to authenticated;
grant execute on function fn_recalcular_estado_orden(uuid) to authenticated;
grant execute on function fn_marcar_pago_maquila(uuid, boolean, date) to authenticated;
grant execute on function fn_reprogramar_pago_maquila(uuid, date) to authenticated;

-- =============================================================================================
-- 9) Órdenes que ya existían: se conservan y regresan a "planeada" (su avance por etapas ya no existe)
-- =============================================================================================
update lotes_produccion set estatus = 'planeada', fecha_fin_real = null where estatus in ('en_proceso', 'terminada');
do $$
declare
  r record;
begin
  for r in select distinct pedido_id from lotes_produccion where pedido_id is not null loop
    perform fn_reevaluar_pedido(r.pedido_id);
  end loop;
end;
$$;
