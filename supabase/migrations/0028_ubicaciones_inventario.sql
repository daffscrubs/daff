-- Inventario de productos terminados por ubicación (Acapol y Zona Industrial),
-- con traspasos entre ubicaciones. Hasta ahora había un solo inventario por
-- producto y talla.

-- =========================================================
-- 1) Catálogo de ubicaciones
-- =========================================================
create table ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden smallint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into ubicaciones (nombre, orden) values
  ('Acapol', 1),
  ('Zona Industrial', 2);

alter table ubicaciones enable row level security;
create policy "admin_supervisor_gestionan_ubicaciones" on ubicaciones for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_ubicaciones" on ubicaciones for select
  using (auth.role() = 'authenticated');

-- Ubicación a la que va todo lo que no indica una (existencias anteriores a
-- esta migración, órdenes sin ubicación destino): la primera activa.
create or replace function fn_ubicacion_predeterminada()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from ubicaciones where activa order by orden, nombre limit 1;
$$;

-- =========================================================
-- 2) Existencias y movimientos por ubicación
-- =========================================================
alter table stock_productos add column ubicacion_id uuid references ubicaciones(id);
update stock_productos set ubicacion_id = fn_ubicacion_predeterminada();
alter table stock_productos alter column ubicacion_id set not null;

alter table stock_productos drop constraint stock_productos_modelo_talla_key;
alter table stock_productos
  add constraint stock_productos_modelo_talla_ubicacion_key unique (modelo_id, talla_id, ubicacion_id);

alter table movimientos_stock_producto add column ubicacion_id uuid references ubicaciones(id);
update movimientos_stock_producto set ubicacion_id = fn_ubicacion_predeterminada();
alter table movimientos_stock_producto alter column ubicacion_id set not null;
-- Red de seguridad: un INSERT que no indique ubicación (código que no conozca
-- esta columna) cae en la predeterminada en vez de fallar.
alter table movimientos_stock_producto alter column ubicacion_id set default fn_ubicacion_predeterminada();

-- Las dos patas de un traspaso (salida del origen + entrada al destino)
-- comparten este id para poder reconocerlas en el historial.
alter table movimientos_stock_producto add column traspaso_id uuid;

create index idx_movimientos_stock_producto_ubicacion on movimientos_stock_producto(ubicacion_id);
create index idx_movimientos_stock_producto_traspaso on movimientos_stock_producto(traspaso_id) where traspaso_id is not null;

create or replace function fn_aplicar_movimiento_stock_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
begin
  v_delta := case
    when new.tipo = 'entrada' then new.cantidad
    when new.tipo = 'salida' then -new.cantidad
    else new.cantidad
  end;

  insert into stock_productos (modelo_id, talla_id, ubicacion_id, cantidad_actual)
  values (new.modelo_id, new.talla_id, new.ubicacion_id, v_delta)
  on conflict (modelo_id, talla_id, ubicacion_id)
  do update set cantidad_actual = stock_productos.cantidad_actual + v_delta;

  return new;
end;
$$;

-- =========================================================
-- 3) Ubicación destino de las piezas terminadas de una orden de producción
-- =========================================================
alter table lotes_produccion add column ubicacion_destino_id uuid references ubicaciones(id);

-- Misma función de avance que 0024; lo único que cambia es la ubicación a la
-- que entran las piezas al completar el último proceso de un producto.
create or replace function fn_validar_y_acumular_avance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden_actual smallint;
  v_lote_id uuid;
  v_lote_estatus text;
  v_item_orden_id uuid;
  v_etapa_id uuid;
  v_actual integer;
  v_parent_id uuid;
  v_es_hijo boolean;
  v_id_efectivo uuid;
  v_orden_efectiva smallint;
  v_etapa_efectiva uuid;
  v_total_previo integer;
  v_total_nuevo integer;
  v_limite integer;
  v_disponible_neto integer;
  v_cantidad_planeada_item integer;
  v_modelo_id uuid;
  v_talla_id uuid;
  v_max_orden smallint;
  v_pedido_id uuid;
  v_pedido_completo boolean;
  v_total_items integer;
  v_items_completos integer;
  v_alguna_actividad boolean;
  v_tiene_funciones_asignadas boolean;
begin
  select le.orden_secuencia, le.lote_id, le.item_orden_id, le.etapa_id, le.cantidad_completada, le.parent_lote_etapa_id
    into v_orden_actual, v_lote_id, v_item_orden_id, v_etapa_id, v_actual, v_parent_id
    from lote_etapas le
    where le.id = new.lote_etapa_id
    for update;

  if v_lote_id is null then
    raise exception 'Etapa de orden de producción inválida';
  end if;

  if new.lote_id <> v_lote_id then
    raise exception 'La orden indicada no coincide con la etapa seleccionada';
  end if;

  select estatus into v_lote_estatus from lotes_produccion where id = v_lote_id;

  if v_lote_estatus = 'cancelada' then
    raise exception 'No se puede registrar avance en una orden cancelada';
  end if;

  v_es_hijo := v_parent_id is not null;

  if v_es_hijo then
    -- bloquea también la fila padre: dos hijas del mismo padre capturando al
    -- mismo tiempo deben serializarse para que el recálculo del mínimo no
    -- quede en una condición de carrera.
    select id, orden_secuencia, etapa_id, cantidad_completada
      into v_id_efectivo, v_orden_efectiva, v_etapa_efectiva, v_total_previo
      from lote_etapas
      where id = v_parent_id
      for update;
  else
    if exists (select 1 from lote_etapas where parent_lote_etapa_id = new.lote_etapa_id) then
      raise exception 'Este proceso tiene sub-procesos configurados; registra el avance en el sub-proceso específico.';
    end if;
    v_id_efectivo := new.lote_etapa_id;
    v_orden_efectiva := v_orden_actual;
    v_etapa_efectiva := v_etapa_id;
    v_total_previo := v_actual;
  end if;

  select cantidad_planeada, modelo_id, talla_id
    into v_cantidad_planeada_item, v_modelo_id, v_talla_id
    from items_orden_produccion where id = v_item_orden_id;

  if new.origen = 'colaborador' then
    select exists(select 1 from colaborador_etapas where perfil_id = new.colaborador_id)
      into v_tiene_funciones_asignadas;

    if v_tiene_funciones_asignadas and not exists (
      select 1 from colaborador_etapas
      where perfil_id = new.colaborador_id and etapa_id = v_etapa_efectiva
    ) then
      raise exception 'Este colaborador no tiene asignado este proceso';
    end if;

    if v_orden_efectiva = 1 then
      v_limite := v_cantidad_planeada_item;
    else
      select cantidad_completada into v_limite
        from lote_etapas
        where item_orden_id = v_item_orden_id and orden_secuencia = v_orden_efectiva - 1;
      v_limite := coalesce(v_limite, 0);
    end if;

    v_disponible_neto := v_limite - v_actual;

    if new.cantidad > v_disponible_neto then
      raise exception 'Cantidad (%) excede el avance disponible de la etapa anterior (%)', new.cantidad, v_disponible_neto;
    end if;
  else
    if v_actual + new.cantidad < 0 then
      raise exception 'El ajuste dejaría el acumulado de la etapa en negativo';
    end if;
  end if;

  update lote_etapas
    set cantidad_completada = v_actual + new.cantidad,
        estatus = case
          when v_actual + new.cantidad <= 0 then 'pendiente'
          when v_actual + new.cantidad >= v_cantidad_planeada_item then 'completa'
          else 'en_proceso'
        end
    where id = new.lote_etapa_id;

  if v_es_hijo then
    select min(cantidad_completada) into v_total_nuevo
      from lote_etapas where parent_lote_etapa_id = v_parent_id;
    v_total_nuevo := coalesce(v_total_nuevo, 0);

    update lote_etapas
      set cantidad_completada = v_total_nuevo,
          estatus = case
            when v_total_nuevo <= 0 then 'pendiente'
            when v_total_nuevo >= v_cantidad_planeada_item then 'completa'
            else 'en_proceso'
          end
      where id = v_id_efectivo;
  else
    v_total_nuevo := v_actual + new.cantidad;
  end if;

  select max(orden_secuencia) into v_max_orden from lote_etapas where item_orden_id = v_item_orden_id;

  if v_orden_efectiva = v_max_orden
     and v_total_previo < v_cantidad_planeada_item
     and v_total_nuevo >= v_cantidad_planeada_item then
    insert into movimientos_stock_producto
      (modelo_id, talla_id, ubicacion_id, tipo, cantidad, orden_produccion_id, motivo)
    values
      (v_modelo_id, v_talla_id,
       coalesce((select ubicacion_destino_id from lotes_produccion where id = v_lote_id), fn_ubicacion_predeterminada()),
       'entrada', v_cantidad_planeada_item, v_lote_id, 'Producción completada');
  end if;

  select count(*) into v_total_items from items_orden_produccion where lote_id = v_lote_id;

  select count(*) into v_items_completos
    from items_orden_produccion io
    join lote_etapas le2 on le2.item_orden_id = io.id
      and le2.orden_secuencia = (select max(orden_secuencia) from lote_etapas where item_orden_id = io.id)
    where io.lote_id = v_lote_id and le2.cantidad_completada >= io.cantidad_planeada;

  select exists (
    select 1 from lote_etapas le3
    join items_orden_produccion io3 on io3.id = le3.item_orden_id
    where io3.lote_id = v_lote_id and le3.cantidad_completada > 0
  ) into v_alguna_actividad;

  if v_total_items > 0 and v_items_completos = v_total_items then
    update lotes_produccion
      set estatus = 'terminada', fecha_fin_real = current_date
      where id = v_lote_id and estatus <> 'terminada';
  elsif v_alguna_actividad then
    update lotes_produccion
      set estatus = 'en_proceso'
      where id = v_lote_id and estatus <> 'en_proceso';
  end if;

  select pedido_id into v_pedido_id from lotes_produccion where id = v_lote_id;

  if v_pedido_id is not null then
    select
      not exists (
        select 1 from lotes_produccion
        where pedido_id = v_pedido_id and estatus <> 'terminada' and estatus <> 'cancelada'
      )
      and exists (
        select 1 from lotes_produccion
        where pedido_id = v_pedido_id and estatus = 'terminada'
      )
      into v_pedido_completo;

    if v_pedido_completo then
      update pedidos set estatus = 'listo'
        where id = v_pedido_id and estatus in ('confirmado', 'en_produccion');
    else
      update pedidos set estatus = 'en_produccion'
        where id = v_pedido_id and estatus in ('confirmado', 'listo');
    end if;
  end if;

  return new;
end;
$$;

-- =========================================================
-- 4) Traspaso atómico entre ubicaciones
-- =========================================================
-- Corre con los permisos de quien la llama (RLS aplica), pero valida el rol
-- primero para dar un mensaje claro en vez de un error de políticas.
create or replace function fn_traspasar_stock_producto(
  p_modelo_id uuid,
  p_talla_id uuid,
  p_origen_id uuid,
  p_destino_id uuid,
  p_cantidad integer,
  p_motivo text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_disponible integer;
  v_traspaso_id uuid := gen_random_uuid();
  v_nombre_origen text;
  v_nombre_destino text;
begin
  if fn_rol_actual() not in ('admin','supervisor') then
    raise exception 'No tienes permiso para traspasar existencias';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a traspasar debe ser mayor a cero';
  end if;
  if p_origen_id = p_destino_id then
    raise exception 'El origen y el destino del traspaso deben ser distintos';
  end if;

  select nombre into v_nombre_origen from ubicaciones where id = p_origen_id;
  select nombre into v_nombre_destino from ubicaciones where id = p_destino_id;
  if v_nombre_origen is null or v_nombre_destino is null then
    raise exception 'Ubicación inválida';
  end if;

  -- Bloquea la fila de origen: dos traspasos simultáneos no pueden sacar las mismas piezas.
  select cantidad_actual into v_disponible
    from stock_productos
    where modelo_id = p_modelo_id and talla_id = p_talla_id and ubicacion_id = p_origen_id
    for update;

  if coalesce(v_disponible, 0) < p_cantidad then
    raise exception 'No hay suficientes piezas en %: disponibles %, solicitadas %',
      v_nombre_origen, coalesce(v_disponible, 0), p_cantidad;
  end if;

  insert into movimientos_stock_producto
    (modelo_id, talla_id, ubicacion_id, tipo, cantidad, motivo, registrado_por, traspaso_id)
  values
    (p_modelo_id, p_talla_id, p_origen_id, 'salida', p_cantidad,
     coalesce(nullif(trim(p_motivo), ''), 'Traspaso a ' || v_nombre_destino), auth.uid(), v_traspaso_id),
    (p_modelo_id, p_talla_id, p_destino_id, 'entrada', p_cantidad,
     coalesce(nullif(trim(p_motivo), ''), 'Traspaso desde ' || v_nombre_origen), auth.uid(), v_traspaso_id);

  return v_traspaso_id;
end;
$$;
