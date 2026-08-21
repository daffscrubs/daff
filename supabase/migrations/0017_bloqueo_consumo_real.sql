-- Registra cuándo se guardó el consumo real de un insumo. Una vez con valor,
-- ese registro queda bloqueado (no se puede editar ni quitar) y pasa a
-- formar parte de la cronología de la orden en vez de seguir siendo editable.
alter table consumo_material_orden add column cantidad_real_registrada_en timestamptz;
