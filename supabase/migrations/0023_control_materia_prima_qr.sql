-- Control de materia prima por unidad física (rollo de tela/resorte, bolsa de
-- botones/cierres/agujetas/etiquetas), cada una con su propio código QR y su
-- propia cantidad restante. Convive con el control por bulto que ya existe
-- (materiales.stock_actual + movimientos_inventario): un material usa uno u
-- otro según `seguimiento_por_unidad`, nunca los dos a la vez.

-- =========================================================
-- 1. Marca qué materiales se controlan por unidad
-- =========================================================
alter table materiales add column seguimiento_por_unidad boolean not null default false;

-- =========================================================
-- 2. unidades_material: cada rollo/bolsa físico
-- =========================================================
create type estatus_unidad_material as enum ('disponible', 'agotado', 'de_baja');

-- Se liga a compra_items (no a compras directamente): una compra puede traer
-- el mismo material en más de una línea con costos distintos, y compra_items
-- ya guarda cantidad + costo_unitario de esa línea específica — ligar ahí
-- evita ambigüedad. compra_item_id es nullable para poder dar de alta una
-- unidad sin compra formal (ajuste manual, carga inicial de lo que ya había).
create table unidades_material (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales(id),
  compra_item_id uuid references compra_items(id),
  numero_unidad integer not null,
  codigo text not null unique,
  cantidad_inicial numeric(10,2) not null check (cantidad_inicial > 0),
  cantidad_actual numeric(10,2) not null,
  costo_unitario numeric(10,2),
  proveedor text,
  estatus estatus_unidad_material not null default 'disponible',
  fecha_recepcion date not null default current_date,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  unique (material_id, numero_unidad)
);

create index idx_unidades_material_material on unidades_material(material_id);
create index idx_unidades_material_compra_item on unidades_material(compra_item_id);
create index idx_unidades_material_codigo on unidades_material(codigo);

-- =========================================================
-- 3. consumo_unidad_orden: qué unidad(es) específica(s) se asignaron/
--    consumieron en una orden de producción
-- =========================================================
create table consumo_unidad_orden (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id),
  unidad_id uuid not null references unidades_material(id),
  cantidad_estimada numeric(10,2),
  cantidad_real numeric(10,2),
  cantidad_real_registrada_en timestamptz,
  created_at timestamptz not null default now(),
  unique (lote_id, unidad_id)
);

create index idx_consumo_unidad_orden_lote on consumo_unidad_orden(lote_id);
create index idx_consumo_unidad_orden_unidad on consumo_unidad_orden(unidad_id);

-- =========================================================
-- 4. Trigger: mantiene consumo_material_orden (la fila agregada por
--    lote+material que ya usan reportes/PDF/dashboard) sincronizada con la
--    suma de todas las unidades asignadas a esa orden para ese material.
--    cantidad_real_registrada_en de la fila agregada = la más antigua entre
--    las unidades ya registradas (o null si ninguna lo está todavía), que es
--    justo la condición que ya usan el PDF de producción y el historial para
--    decidir si mostrar cantidad_real.
-- =========================================================
create or replace function fn_sincronizar_consumo_material_desde_unidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id uuid;
  v_material_id uuid;
  v_estimada numeric(10,2);
  v_real numeric(10,2);
  v_registrada_en timestamptz;
begin
  if tg_op = 'DELETE' then
    v_lote_id := old.lote_id;
    select material_id into v_material_id from unidades_material where id = old.unidad_id;
  else
    v_lote_id := new.lote_id;
    select material_id into v_material_id from unidades_material where id = new.unidad_id;
  end if;

  select
    coalesce(sum(cuo.cantidad_estimada), 0),
    coalesce(sum(cuo.cantidad_real), 0),
    min(cuo.cantidad_real_registrada_en)
    into v_estimada, v_real, v_registrada_en
    from consumo_unidad_orden cuo
    join unidades_material um on um.id = cuo.unidad_id
    where cuo.lote_id = v_lote_id and um.material_id = v_material_id;

  insert into consumo_material_orden
    (lote_id, material_id, cantidad_estimada, cantidad_real, cantidad_real_registrada_en)
    values (v_lote_id, v_material_id, v_estimada, v_real, v_registrada_en)
  on conflict (lote_id, material_id) do update
    set cantidad_estimada = excluded.cantidad_estimada,
        cantidad_real = excluded.cantidad_real,
        cantidad_real_registrada_en = excluded.cantidad_real_registrada_en;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_sincronizar_consumo_material_desde_unidad
  after insert or update or delete on consumo_unidad_orden
  for each row execute function fn_sincronizar_consumo_material_desde_unidad();

-- =========================================================
-- 5. Trigger: al registrarse por primera vez cantidad_real en una fila de
--    consumo_unidad_orden, descuenta esa cantidad de la unidad específica y
--    la marca 'agotado' si queda en 0 o menos. Mismo patrón de "se dispara
--    solo la primera vez" que ya usa la app para bloquear ediciones
--    posteriores (cantidad_real_registrada_en pasa de null a con valor).
-- =========================================================
create or replace function fn_descontar_unidad_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restante numeric(10,2);
begin
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

create trigger trg_descontar_unidad_material
  after update on consumo_unidad_orden
  for each row
  when (old.cantidad_real_registrada_en is null and new.cantidad_real_registrada_en is not null)
  execute function fn_descontar_unidad_material();

-- =========================================================
-- 6. RLS — mismo patrón que materiales/movimientos_inventario/
--    consumo_material_orden: admin y supervisor gestionan, cualquier
--    autenticado lee.
-- =========================================================
alter table unidades_material enable row level security;
create policy "admin_supervisor_gestionan_unidades_material" on unidades_material for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_unidades_material" on unidades_material for select
  using (auth.role() = 'authenticated');

alter table consumo_unidad_orden enable row level security;
create policy "admin_supervisor_gestionan_consumo_unidad" on consumo_unidad_orden for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_consumo_unidad" on consumo_unidad_orden for select
  using (auth.role() = 'authenticated');
