-- Quién hará la orden se decide DESPUÉS de crearla.
--
-- Los cortes muchas veces quedan parados y, según la necesidad del momento, se mandan a maquilar o se hacen en el
-- taller. Por eso una orden nueva queda "sin asignar" y se asigna (interna o maquila con su maquilero y precios)
-- cuando haya que moverla. Mientras no tenga entregas se puede cambiar de opinión; con entregas ya no.
-- Registrar una entrega exige que la orden ya esté asignada.

alter table lotes_produccion drop constraint if exists lotes_tipo_maquilero;
alter table lotes_produccion drop constraint if exists lotes_produccion_tipo_produccion_check;
alter table lotes_produccion
  add constraint lotes_produccion_tipo_produccion_check check (tipo_produccion in ('sin_asignar', 'interna', 'maquila')),
  add constraint lotes_tipo_maquilero check (
    (tipo_produccion <> 'maquila' and maquilero_id is null) or (tipo_produccion = 'maquila' and maquilero_id is not null)
  );
alter table lotes_produccion alter column tipo_produccion set default 'sin_asignar';
alter table lotes_produccion add column fecha_asignacion date;   -- cuándo se mandó a maquila o se asignó al taller

-- Las órdenes que ya existían quedaron como "interna" solo por el valor por defecto de la migración anterior:
-- si todavía no tienen entregas, nadie las ha asignado de verdad.
update lotes_produccion l set tipo_produccion = 'sin_asignar'
  where tipo_produccion = 'interna'
    and not exists (select 1 from entregas_produccion e where e.lote_id = l.id and e.estatus = 'registrada');

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
  if v_lote.tipo_produccion = 'sin_asignar' then
    raise exception 'La orden % todavía no tiene asignado quién la hará. Asígnala a producción interna o a un maquilero antes de registrar entregas', v_lote.folio;
  end if;
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
