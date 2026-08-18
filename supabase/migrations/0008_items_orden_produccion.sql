-- Permite que una orden de producción tenga varios productos (ej. 10 filipinas
-- CH + 10 medianas dentro de la misma orden), cada uno con su propio avance por etapa.

create table items_orden_produccion (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id) on delete cascade,
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  cantidad_planeada integer not null check (cantidad_planeada > 0)
);

create index idx_items_orden_produccion_lote on items_orden_produccion(lote_id);

-- Migra las órdenes existentes (antes 1 producto por orden) a un ítem equivalente.
insert into items_orden_produccion (lote_id, modelo_id, talla_id, variante_id, cantidad_planeada)
select id, modelo_id, talla_id, variante_id, cantidad_planeada from lotes_produccion;

-- lote_etapas ahora trazan el avance por ítem, no por orden completa.
alter table lote_etapas add column item_orden_id uuid references items_orden_produccion(id) on delete cascade;

update lote_etapas le
set item_orden_id = io.id
from items_orden_produccion io
where io.lote_id = le.lote_id;

alter table lote_etapas alter column item_orden_id set not null;

alter table lote_etapas drop constraint lote_etapas_lote_id_orden_secuencia_key;
alter table lote_etapas drop constraint lote_etapas_lote_id_etapa_id_key;
alter table lote_etapas add constraint lote_etapas_item_orden_id_orden_secuencia_key unique (item_orden_id, orden_secuencia);
alter table lote_etapas add constraint lote_etapas_item_orden_id_etapa_id_key unique (item_orden_id, etapa_id);

create index idx_lote_etapas_item_orden on lote_etapas(item_orden_id);

-- Los datos de producto ahora viven en items_orden_produccion; la orden queda
-- solo como encabezado (folio, pedido, estatus, fechas).
alter table lotes_produccion drop column modelo_id;
alter table lotes_produccion drop column talla_id;
alter table lotes_produccion drop column variante_id;
alter table lotes_produccion drop column cantidad_planeada;

alter table items_orden_produccion enable row level security;
create policy "admin_supervisor_gestionan_items_orden" on items_orden_produccion for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_items_orden" on items_orden_produccion for select
  using (auth.role() = 'authenticated');
