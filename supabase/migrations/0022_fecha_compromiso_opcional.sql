-- La fecha compromiso ya no es obligatoria al crear un pedido.
alter table pedidos alter column fecha_compromiso drop not null;
