-- Precio de venta por modelo (distinto del costo de producción)
alter table modelos add column precio_venta numeric(10,2);

-- Tallas disponibles por modelo (ej. "Filipina de dama" solo en CH/M/G/XG,
-- "Pantalón de caballero" solo en 28/30/32). Si un modelo no tiene tallas
-- asignadas, se asume que aplican todas (comportamiento previo).
create table modelo_tallas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos(id) on delete cascade,
  talla_id uuid not null references tallas(id) on delete cascade,
  unique (modelo_id, talla_id)
);

create index idx_modelo_tallas_modelo on modelo_tallas(modelo_id);

alter table modelo_tallas enable row level security;

create policy "admin_supervisor_gestionan_modelo_tallas" on modelo_tallas for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));

create policy "autenticados_leen_modelo_tallas" on modelo_tallas for select
  using (auth.role() = 'authenticated');
