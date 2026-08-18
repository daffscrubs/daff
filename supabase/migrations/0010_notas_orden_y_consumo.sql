-- Notas libres por orden de producción
alter table lotes_produccion add column notas text;

-- Fecha de asignación, útil para mostrarlo en la cronología de la orden
alter table consumo_material_orden add column created_at timestamptz not null default now();
