-- Permite asignar a cada colaborador qué procesos (etapas) puede realizar,
-- ej. Jesús solo Corte, Martha solo Confección. Si un colaborador no tiene
-- ninguna etapa asignada, puede capturar avance en cualquier etapa (comportamiento
-- previo, para no romper cuentas ya existentes sin configurar).
create table colaborador_etapas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade,
  etapa_id uuid not null references etapas_proceso(id) on delete cascade,
  unique (perfil_id, etapa_id)
);

create index idx_colaborador_etapas_perfil on colaborador_etapas(perfil_id);

alter table colaborador_etapas enable row level security;

create policy "admin_supervisor_gestionan_colaborador_etapas" on colaborador_etapas for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));

create policy "colaborador_lee_sus_etapas" on colaborador_etapas for select
  using (perfil_id = auth.uid() or fn_rol_actual() in ('admin','supervisor','ventas'));

-- Refuerza la regla en el trigger: si el colaborador tiene funciones asignadas,
-- solo puede capturar avance (no ajustes, esos los hace un supervisor) en esas etapas.
create or replace function fn_validar_y_acumular_avance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden_actual smallint;
  v_lote_id uuid;
  v_item_orden_id uuid;
  v_etapa_id uuid;
  v_actual integer;
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
  select le.orden_secuencia, le.lote_id, le.item_orden_id, le.etapa_id, le.cantidad_completada
    into v_orden_actual, v_lote_id, v_item_orden_id, v_etapa_id, v_actual
    from lote_etapas le
    where le.id = new.lote_etapa_id
    for update;

  if v_lote_id is null then
    raise exception 'Etapa de orden de producción inválida';
  end if;

  if new.lote_id <> v_lote_id then
    raise exception 'La orden indicada no coincide con la etapa seleccionada';
  end if;

  select cantidad_planeada, modelo_id, talla_id
    into v_cantidad_planeada_item, v_modelo_id, v_talla_id
    from items_orden_produccion where id = v_item_orden_id;

  if new.origen = 'colaborador' then
    select exists(select 1 from colaborador_etapas where perfil_id = new.colaborador_id)
      into v_tiene_funciones_asignadas;

    if v_tiene_funciones_asignadas and not exists (
      select 1 from colaborador_etapas
      where perfil_id = new.colaborador_id and etapa_id = v_etapa_id
    ) then
      raise exception 'Este colaborador no tiene asignado este proceso';
    end if;

    if v_orden_actual = 1 then
      v_limite := v_cantidad_planeada_item;
    else
      select cantidad_completada into v_limite
        from lote_etapas
        where item_orden_id = v_item_orden_id and orden_secuencia = v_orden_actual - 1;
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

  select max(orden_secuencia) into v_max_orden from lote_etapas where item_orden_id = v_item_orden_id;

  if v_orden_actual = v_max_orden
     and v_actual < v_cantidad_planeada_item
     and v_actual + new.cantidad >= v_cantidad_planeada_item then
    insert into movimientos_stock_producto
      (modelo_id, talla_id, tipo, cantidad, orden_produccion_id, motivo)
    values
      (v_modelo_id, v_talla_id, 'entrada', v_cantidad_planeada_item, v_lote_id, 'Producción completada');
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
    select not exists (
      select 1 from lotes_produccion
      where pedido_id = v_pedido_id and estatus <> 'terminada' and estatus <> 'cancelada'
    ) into v_pedido_completo;

    if v_pedido_completo then
      update pedidos set estatus = 'listo'
        where id = v_pedido_id and estatus in ('confirmado', 'en_produccion');
    else
      update pedidos set estatus = 'en_produccion'
        where id = v_pedido_id and estatus = 'confirmado';
    end if;
  end if;

  return new;
end;
$$;
