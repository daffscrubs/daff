-- Función y trigger que validan y acumulan el avance de producción por etapa.
--
-- Regla de negocio: una etapa solo puede acumular hasta lo que la etapa anterior
-- del mismo lote ya completó (la primera etapa tiene como tope cantidad_planeada
-- del lote). Los ajustes de supervisor pueden ser positivos o negativos y no
-- respetan ese tope, pero nunca pueden dejar el acumulado de una etapa en negativo.
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
  v_max_orden smallint;
  v_pedido_id uuid;
  v_pedido_completo boolean;
begin
  -- bloquea la fila de la etapa para evitar condiciones de carrera entre
  -- capturas simultáneas de distintos colaboradores sobre la misma etapa
  select le.orden_secuencia, le.lote_id, le.cantidad_completada
    into v_orden_actual, v_lote_id, v_actual
    from lote_etapas le
    where le.id = new.lote_etapa_id
    for update;

  if v_lote_id is null then
    raise exception 'Etapa de lote inválida';
  end if;

  if new.lote_id <> v_lote_id then
    raise exception 'El lote indicado no coincide con la etapa seleccionada';
  end if;

  select cantidad_planeada into v_cantidad_planeada
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
    -- ajuste_supervisor: no valida contra la etapa anterior, pero no permite negativos
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

  -- si la etapa que se acaba de actualizar es la última del lote y llegó a
  -- la cantidad planeada, el lote se marca terminado
  select max(orden_secuencia) into v_max_orden from lote_etapas where lote_id = v_lote_id;

  if v_orden_actual = v_max_orden then
    if v_actual + new.cantidad >= v_cantidad_planeada then
      update lotes_produccion
        set estatus = 'terminada', fecha_fin_real = current_date
        where id = v_lote_id and estatus <> 'terminada';
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

  -- cascada: si todos los lotes del pedido están terminados, el pedido pasa a 'listo'
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

create trigger trg_validar_avance
  before insert on registros_avance_colaborador
  for each row execute function fn_validar_y_acumular_avance();

-- =========================================================
-- Stock de materiales: se mantiene a partir de los movimientos de inventario
-- =========================================================
create or replace function fn_aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update materiales
    set stock_actual = stock_actual + case
      when new.tipo = 'entrada' then new.cantidad
      when new.tipo = 'salida' then -new.cantidad
      else new.cantidad -- 'ajuste': cantidad puede ser positiva o negativa
    end
    where id = new.material_id;

  return new;
end;
$$;

create trigger trg_aplicar_movimiento_inventario
  after insert on movimientos_inventario
  for each row execute function fn_aplicar_movimiento_inventario();
