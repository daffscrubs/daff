-- Corte de caja por método de pago: además del efectivo del cajón, se puede registrar el recuento de lo cobrado
-- con tarjeta y por transferencia (contra el corte de la terminal y el estado de cuenta) y comparar cada uno con
-- lo que el sistema registró. Tarjeta y transferencia son opcionales: vacío = "sin contar", no "faltante".

alter table cajas_sesiones
  add column tarjeta_esperado numeric(12,2),
  add column tarjeta_contado numeric(12,2) check (tarjeta_contado is null or tarjeta_contado >= 0),
  add column transferencia_esperado numeric(12,2),
  add column transferencia_contado numeric(12,2) check (transferencia_contado is null or transferencia_contado >= 0);

-- Lo que debería haber por método en un turno (ventas no canceladas; el efectivo incluye fondo, ingresos y retiros).
create or replace function fn_totales_esperados(p_sesion_id uuid)
returns table (efectivo numeric, tarjeta numeric, transferencia numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    fn_efectivo_esperado(p_sesion_id),
    coalesce((select sum(p.monto) from venta_pagos p join ventas v on v.id = p.venta_id
              where v.sesion_id = p_sesion_id and v.estatus = 'completada' and p.metodo = 'tarjeta'), 0),
    coalesce((select sum(p.monto) from venta_pagos p join ventas v on v.id = p.venta_id
              where v.sesion_id = p_sesion_id and v.estatus = 'completada' and p.metodo = 'transferencia'), 0)
  where fn_tiene_permiso('modulo.caja');
$$;

-- Misma función de cierre con los dos conteos opcionales. Se reemplaza la anterior (si quedaran las dos, una
-- llamada con tres argumentos sería ambigua). Sigue regresando la diferencia del efectivo (contado - esperado).
drop function if exists fn_cerrar_caja(uuid, numeric, text);
create function fn_cerrar_caja(
  p_sesion_id uuid,
  p_efectivo_contado numeric,
  p_notas text default null,
  p_tarjeta_contado numeric default null,
  p_transferencia_contado numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esperado numeric;
  v_tarjeta numeric;
  v_transferencia numeric;
begin
  if not fn_tiene_permiso('caja.abrir_cerrar') then
    raise exception 'No tienes permiso para cerrar la caja';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Cuenta el efectivo del cajón e ingresa la cantidad (puede ser 0)';
  end if;
  if p_tarjeta_contado < 0 or p_transferencia_contado < 0 then
    raise exception 'Los recuentos de tarjeta y transferencia no pueden ser negativos';
  end if;

  perform 1 from cajas_sesiones where id = p_sesion_id and fecha_cierre is null for update;
  if not found then raise exception 'La caja ya está cerrada o no existe'; end if;

  v_esperado := fn_efectivo_esperado(p_sesion_id);
  select coalesce(sum(p.monto) filter (where p.metodo = 'tarjeta'), 0), coalesce(sum(p.monto) filter (where p.metodo = 'transferencia'), 0)
    into v_tarjeta, v_transferencia
    from venta_pagos p join ventas v on v.id = p.venta_id
    where v.sesion_id = p_sesion_id and v.estatus = 'completada';

  update cajas_sesiones
    set cerrada_por = auth.uid(),
        fecha_cierre = now(),
        efectivo_esperado = v_esperado,
        efectivo_contado = p_efectivo_contado,
        tarjeta_esperado = v_tarjeta,
        tarjeta_contado = round(p_tarjeta_contado, 2),
        transferencia_esperado = v_transferencia,
        transferencia_contado = round(p_transferencia_contado, 2),
        notas_cierre = nullif(btrim(p_notas), '')
    where id = p_sesion_id;
  return p_efectivo_contado - v_esperado;
end;
$$;
