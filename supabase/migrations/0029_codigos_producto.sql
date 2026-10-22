-- Código de barras y SKU por variante (producto + talla). Un mismo producto
-- tiene un código distinto en cada talla, así que viven en modelo_tallas.
alter table modelo_tallas add column codigo_barras text;
alter table modelo_tallas add column sku text;

-- Nunca vacíos (un texto vacío cuenta como "sin código" y se guarda como NULL)...
alter table modelo_tallas
  add constraint modelo_tallas_codigo_barras_no_vacio check (codigo_barras is null or btrim(codigo_barras) <> '');
alter table modelo_tallas
  add constraint modelo_tallas_sku_no_vacio check (sku is null or btrim(sku) <> '');

-- ...y únicos: dos variantes no pueden compartir código (se buscaría el producto equivocado
-- al escanear). Los índices parciales permiten tener muchas variantes sin código.
create unique index modelo_tallas_codigo_barras_key on modelo_tallas (codigo_barras) where codigo_barras is not null;
create unique index modelo_tallas_sku_key on modelo_tallas (sku) where sku is not null;
