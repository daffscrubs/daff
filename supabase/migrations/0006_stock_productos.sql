-- Inventario de prendas terminadas (modelo + talla + variante), con trazabilidad
-- de la orden de producción de la que salió cada entrada.
create table stock_productos (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  cantidad_actual integer not null default 0
);

-- Postgres trata NULL como distinto en una unique constraint normal, así que
-- se necesitan dos índices parciales para cubrir "con variante" y "sin variante".
create unique index stock_productos_con_variante_idx
  on stock_productos (modelo_id, talla_id, variante_id) where variante_id is not null;
create unique index stock_productos_sin_variante_idx
  on stock_productos (modelo_id, talla_id) where variante_id is null;

create table movimientos_stock_producto (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  tipo tipo_movimiento not null,
  cantidad integer not null,
  orden_produccion_id uuid references lotes_produccion(id),
  motivo text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create index idx_movimientos_stock_producto_modelo on movimientos_stock_producto(modelo_id, talla_id, variante_id);
create index idx_movimientos_stock_producto_orden on movimientos_stock_producto(orden_produccion_id);

-- Mantiene stock_productos.cantidad_actual a partir del historial de movimientos,
-- igual que fn_aplicar_movimiento_inventario para materiales.
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

  if new.variante_id is not null then
    insert into stock_productos (modelo_id, talla_id, variante_id, cantidad_actual)
    values (new.modelo_id, new.talla_id, new.variante_id, v_delta)
    on conflict (modelo_id, talla_id, variante_id) where variante_id is not null
    do update set cantidad_actual = stock_productos.cantidad_actual + v_delta;
  else
    insert into stock_productos (modelo_id, talla_id, variante_id, cantidad_actual)
    values (new.modelo_id, new.talla_id, null, v_delta)
    on conflict (modelo_id, talla_id) where variante_id is null
    do update set cantidad_actual = stock_productos.cantidad_actual + v_delta;
  end if;

  return new;
end;
$$;

create trigger trg_aplicar_movimiento_stock_producto
  after insert on movimientos_stock_producto
  for each row execute function fn_aplicar_movimiento_stock_producto();

-- RLS: mismo patrón que materiales
alter table stock_productos enable row level security;
create policy "admin_supervisor_gestionan_stock_productos" on stock_productos for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_stock_productos" on stock_productos for select
  using (auth.role() = 'authenticated');

alter table movimientos_stock_producto enable row level security;
create policy "admin_supervisor_gestionan_movimientos_stock_producto" on movimientos_stock_producto for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_movimientos_stock_producto" on movimientos_stock_producto for select
  using (auth.role() = 'authenticated');
