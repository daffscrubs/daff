-- Para la mayoría de los materiales por unidad, un rollo/bolsa ES la unidad
-- de medida (ej. unidad_medida = "Rollo"): no tiene sentido medir "cuánto le
-- queda por dentro", es 1 ítem completo, disponible o usado. Forzar ahí un
-- número (cantidad_inicial/cantidad_actual) causó confusión repetida: la
-- gente termina poniendo "cuántos rollos tengo" en el campo equivocado y
-- generando unidades con cantidades absurdas (25 Rollo, 3 Rollo...).
--
-- mide_cantidad_por_unidad hace esto explícito por material: false (default)
-- = conteo simple, cada unidad vale 1 sin pedir ni mostrar números; true =
-- el material sí necesita medir una cantidad continua dentro de cada unidad
-- (ej. metros dentro de un rollo de tela), y se conserva el comportamiento
-- actual de cantidad_inicial/cantidad_actual.
alter table materiales add column mide_cantidad_por_unidad boolean not null default false;

-- Defensa real: nunca debe poder registrarse un consumo real mayor a lo que
-- le queda a la unidad (se vio en producción una unidad con cantidad_actual
-- en -1). materiales.actions.ts ya valida esto antes de escribir para dar un
-- mensaje claro, pero el trigger es la última línea de defensa a nivel de
-- base de datos.
create or replace function fn_descontar_unidad_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual numeric(10,2);
  v_restante numeric(10,2);
begin
  select cantidad_actual into v_actual from unidades_material where id = new.unidad_id;

  if coalesce(new.cantidad_real, 0) > v_actual then
    raise exception 'El consumo real (%) excede lo que le queda a esta unidad (%)', new.cantidad_real, v_actual;
  end if;

  update unidades_material
    set cantidad_actual = cantidad_actual - coalesce(new.cantidad_real, 0)
    where id = new.unidad_id
    returning cantidad_actual into v_restante;

  if v_restante <= 0 then
    update unidades_material set estatus = 'agotado' where id = new.unidad_id;
  end if;

  return new;
end;
$$;
