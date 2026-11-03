-- Costo por variante (producto + talla). Hasta ahora el costo vivía solo en el
-- producto; ahora cada talla puede tener el suyo. Si una talla no lo tiene, se
-- sigue usando el costo del producto (modelos.costo_unitario), así que nada
-- de lo existente cambia.
alter table modelo_tallas
  add column costo_unitario numeric(10,2) check (costo_unitario is null or costo_unitario >= 0);
