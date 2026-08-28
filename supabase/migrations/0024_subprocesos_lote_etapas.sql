-- Sub-procesos opcionales dentro de un proceso de producción (ej. Confección
-- con Manga/Delantero/Trasero/Cuello). Se configuran por orden de producción,
-- no en el catálogo: cada lote decide si un proceso los necesita o no.
--
-- Un sub-proceso es otra fila de lote_etapas, "hija" de la fila del proceso
-- padre, en vez de ocupar su propio lugar en la secuencia principal. Si un
-- proceso no tiene hijas, se comporta exactamente igual que antes.

alter table lote_etapas add column parent_lote_etapa_id uuid references lote_etapas(id) on delete cascade;
alter table lote_etapas add column nombre_subproceso text;
alter table lote_etapas alter column etapa_id drop not null;
alter table lote_etapas alter column orden_secuencia drop not null;

-- Una fila es "padre" (proceso normal: etapa_id + orden_secuencia propios,
-- sin padre ni nombre libre) o "hija" (sub-proceso: nombre libre + referencia
-- a su padre, sin etapa_id/orden_secuencia propios) -- nunca una mezcla de
-- ambas, ni ninguna de las dos.
alter table lote_etapas add constraint lote_etapas_tipo_fila_check check (
  (parent_lote_etapa_id is null and etapa_id is not null and orden_secuencia is not null and nombre_subproceso is null)
  or
  (parent_lote_etapa_id is not null and etapa_id is null and orden_secuencia is null and nombre_subproceso is not null)
);

-- Evita nombres de sub-proceso duplicados bajo el mismo padre (ej. dos
-- "Manga" en la misma fila de Confección de un mismo producto).
create unique index lote_etapas_padre_nombre_subproceso_key
  on lote_etapas (parent_lote_etapa_id, nombre_subproceso)
  where parent_lote_etapa_id is not null;

create index idx_lote_etapas_parent on lote_etapas(parent_lote_etapa_id);

-- Reescribe fn_validar_y_acumular_avance para soportar sub-procesos:
--   - Un proceso con hijas ya no acepta captura directa (ni de colaborador ni
--     de ajuste_supervisor): hay que capturar en el sub-proceso específico.
--   - Una hija valida su tope contra lo mismo que validaría su padre (lo que
--     ya completó el proceso anterior en la secuencia), y el permiso de
--     colaborador_etapas se revisa contra el etapa_id del padre.
--   - Después de acumular en una hija, el padre se recalcula como el mínimo
--     entre todas sus hijas (el cuello de botella), y todo lo que sigue
--     (stock de producto terminado, si el ítem/lote/pedido se completó) opera
--     sobre ese total del padre, exactamente igual que antes.
-- Cuando ningún proceso tiene hijas (todo lo existente hoy), el
-- comportamiento es idéntico al de antes de esta migración.
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
