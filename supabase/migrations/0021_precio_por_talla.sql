-- Precio de venta por combinación modelo+talla (ej. "capa de graduación"
-- CH/M cuesta $625, G/XG cuesta $640). Nulo = usa el precio general del
-- modelo (modelos.precio_venta) como respaldo.
alter table modelo_tallas add column precio_venta numeric(10,2);
