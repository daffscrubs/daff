-- Compras de materia prima: cada compra tiene varios materiales; al registrarla
-- se generan automáticamente las entradas de inventario correspondientes
-- (esto se hace desde la Server Action, no aquí, para poder actualizar
-- materiales.costo_unitario en la misma operación).
create table compras (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,
  proveedor text not null,
  fecha date not null default current_date,
  total numeric(12,2) not null default 0,
  notas text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create table compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  material_id uuid not null references materiales(id),
  cantidad numeric(12,2) not null check (cantidad > 0),
  costo_unitario numeric(10,2) not null check (costo_unitario >= 0),
  subtotal numeric(12,2) generated always as (cantidad * costo_unitario) stored
);

create index idx_compra_items_compra on compra_items(compra_id);
create index idx_compra_items_material on compra_items(material_id);

-- Gastos generales del taller (renta, servicios, nómina, transporte, etc.),
-- independientes del inventario.
create table gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text not null,
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  notas text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

alter table compras enable row level security;
create policy "admin_supervisor_gestionan_compras" on compras for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "ventas_lee_compras" on compras for select
  using (fn_rol_actual() = 'ventas');

alter table compra_items enable row level security;
create policy "admin_supervisor_gestionan_compra_items" on compra_items for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "ventas_lee_compra_items" on compra_items for select
  using (fn_rol_actual() = 'ventas');

alter table gastos enable row level security;
create policy "admin_ventas_gestionan_gastos" on gastos for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_gastos" on gastos for select
  using (fn_rol_actual() = 'supervisor');
