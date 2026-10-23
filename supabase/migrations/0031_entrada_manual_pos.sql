-- Entrada manual en el punto de venta: partidas que no están en el inventario (servicios, productos
-- sueltos, cobros varios). No mueven existencias; guardan unidad, costo e impuestos de la partida.
-- Los precios de estas partidas los captura quien vende, por eso van con su propio permiso
-- (pos.entrada_manual): el precio de los productos del inventario sigue saliendo siempre de la base.
--
-- Impuestos: el precio capturado es el precio final (IVA incluido, como en el resto de los productos).
-- La tasa se guarda con la partida para el desglose; no se suma otra vez al total.

alter table venta_items alter column modelo_id drop not null;
alter table venta_items alter column talla_id drop not null;
alter table venta_items alter column cantidad type numeric(12,3);
alter table venta_items
  add column unidad text not null default 'Unidad',
  add column costo_unitario numeric(12,2) check (costo_unitario is null or costo_unitario >= 0),
  add column iva_tasa numeric(5,2) not null default 0 check (iva_tasa between 0 and 100),
  add column ieps_tasa numeric(5,2) not null default 0 check (ieps_tasa between 0 and 200),
  add constraint venta_items_producto_o_manual check (
    (modelo_id is not null and talla_id is not null) or (modelo_id is null and talla_id is null)
  );

-- El permiso nuevo: lo reciben por defecto ventas y supervisor, y quienes ya pueden vender hoy.
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
      'modulo.pos','modulo.caja','pos.ver_ventas','pos.entrada_manual','caja.abrir_cerrar','caja.ingresos'
    ]
    when 'supervisor' then array[
      'modulo.dashboard','modulo.produccion','modulo.inventario','modulo.catalogos','modulo.materiales',
      'modulo.compras','modulo.bordados','modulo.reportes',
      'modulo.pos','modulo.caja','pos.ver_ventas','pos.entrada_manual','pos.descuentos','pos.cancelar',
      'caja.abrir_cerrar','caja.ingresos','caja.retiros'
    ]
    else array[]::text[]
  end;
$$;

update perfiles
  set permisos = array_append(permisos, 'pos.entrada_manual')
  where rol in ('ventas', 'supervisor') and 'modulo.pos' = any(permisos) and not ('pos.entrada_manual' = any(permisos));

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
    where case when e->>'manual' = 'true' then
        btrim(coalesce(e->>'nombre', '')) = '' or length(e->>'nombre') > 120
        or length(coalesce(e->>'unidad', '')) > 20
        or (case when coalesce(e->>'cantidad', '') ~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' then (e->>'cantidad')::numeric else 0 end) <= 0
        or (case when coalesce(e->>'precio', '') ~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then (e->>'precio')::numeric else 0 end) <= 0
        or (e->>'costo' is not null and e->>'costo' !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$')
        or (case when coalesce(e->>'iva', '0') ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then (coalesce(e->>'iva', '0'))::numeric else 1000 end) > 100
        or (case when coalesce(e->>'ieps', '0') ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then (coalesce(e->>'ieps', '0'))::numeric else 1000 end) > 200
      else
        coalesce(e->>'cantidad', '') !~ '^[0-9]+$' or (case when coalesce(e->>'cantidad', '') ~ '^[0-9]{1,9}$' then (e->>'cantidad')::int else 0 end) < 1
        or coalesce(e->>'modelo_id', '') = '' or coalesce(e->>'talla_id', '') = ''
      end
  ) then
    raise exception 'La lista de productos tiene datos inválidos';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where e->>'manual' = 'true') and not fn_tiene_permiso('pos.entrada_manual') then
    raise exception 'No tienes permiso para agregar productos con entrada manual';
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
    where coalesce(e->>'manual', '') <> 'true'
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

  -- Entrada manual: productos o servicios que no están en el inventario (no mueven existencias).
  for v_linea in
    select btrim(e->>'nombre') as nombre, (e->>'cantidad')::numeric as cantidad,
           coalesce(nullif(btrim(e->>'unidad'), ''), 'Unidad') as unidad, (e->>'precio')::numeric as precio,
           (e->>'costo')::numeric as costo, coalesce((e->>'iva')::numeric, 0) as iva, coalesce((e->>'ieps')::numeric, 0) as ieps
    from jsonb_array_elements(p_items) e
    where e->>'manual' = 'true'
  loop
    v_importe := round(v_linea.precio * v_linea.cantidad, 2);
    insert into venta_items (venta_id, modelo_id, talla_id, descripcion, cantidad, unidad, precio_unitario, costo_unitario, iva_tasa, ieps_tasa, importe)
    values (v_venta, null, null, v_linea.nombre, v_linea.cantidad, v_linea.unidad, v_linea.precio, v_linea.costo, v_linea.iva, v_linea.ieps, v_importe);
    v_subtotal := v_subtotal + v_importe;
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

  for v_item in select modelo_id, talla_id, cantidad::int as cantidad from venta_items where venta_id = p_venta_id and modelo_id is not null order by modelo_id, talla_id loop
    insert into movimientos_stock_producto (modelo_id, talla_id, ubicacion_id, tipo, cantidad, motivo, registrado_por)
    values (v_item.modelo_id, v_item.talla_id, v_venta.ubicacion_id, 'entrada', v_item.cantidad,
            'Cancelación de ' || v_venta.folio, auth.uid());
  end loop;

  update ventas
    set estatus = 'cancelada', cancelada_por = auth.uid(), fecha_cancelacion = now(), motivo_cancelacion = btrim(p_motivo)
    where id = p_venta_id;
end;
$$;
