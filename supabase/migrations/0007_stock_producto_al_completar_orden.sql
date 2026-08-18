-- Cuando una orden de producción se completa por primera vez, genera
-- automáticamente una entrada de stock de producto terminado, trazable a esa
-- orden (orden_produccion_id).
create or replace function fn_validar_y_acumular_avance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden_actual smallint;
  v_lote_id uuid;
  v_actual integer;
  v_limite integer;
  v_disponible_neto integer;
  v_cantidad_planeada integer;
  v_modelo_id uuid;
  v_talla_id uuid;
  v_variante_id uuid;
  v_max_orden smallint;
  v_pedido_id uuid;
  v_pedido_completo boolean;
begin
  select le.orden_secuencia, le.lote_id, le.cantidad_completada
    into v_orden_actual, v_lote_id, v_actual
    from lote_etapas le
    where le.id = new.lote_etapa_id
    for update;

  if v_lote_id is null then
    raise exception 'Etapa de orden de producción inválida';
  end if;

  if new.lote_id <> v_lote_id then
    raise exception 'La orden indicada no coincide con la etapa seleccionada';
  end if;

  select cantidad_planeada, modelo_id, talla_id, variante_id
    into v_cantidad_planeada, v_modelo_id, v_talla_id, v_variante_id
    from lotes_produccion where id = v_lote_id;

  if new.origen = 'colaborador' then
    if v_orden_actual = 1 then
      v_limite := v_cantidad_planeada;
    else
      select cantidad_completada into v_limite
        from lote_etapas
        where lote_id = v_lote_id and orden_secuencia = v_orden_actual - 1;
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
          when v_actual + new.cantidad >= v_cantidad_planeada then 'completa'
          else 'en_proceso'
        end
    where id = new.lote_etapa_id;

  select max(orden_secuencia) into v_max_orden from lote_etapas where lote_id = v_lote_id;

  if v_orden_actual = v_max_orden then
    if v_actual + new.cantidad >= v_cantidad_planeada then
      update lotes_produccion
        set estatus = 'terminada', fecha_fin_real = current_date
        where id = v_lote_id and estatus <> 'terminada';

      -- solo la primera vez que la orden pasa a 'terminada' se genera la
      -- entrada de stock de producto terminado
      if found then
        insert into movimientos_stock_producto
          (modelo_id, talla_id, variante_id, tipo, cantidad, orden_produccion_id, motivo)
        values
          (v_modelo_id, v_talla_id, v_variante_id, 'entrada', v_cantidad_planeada, v_lote_id, 'Producción completada');
      end if;
    elsif v_actual + new.cantidad < v_cantidad_planeada then
      update lotes_produccion
        set estatus = 'en_proceso'
        where id = v_lote_id and estatus = 'terminada';
    end if;
  else
    update lotes_produccion
      set estatus = 'en_proceso'
      where id = v_lote_id and estatus = 'planeada';
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
