-- Datos base de catálogos: etapas de proceso y tallas estándar
insert into etapas_proceso (nombre, descripcion) values
  ('Corte', 'Corte de piezas a partir de la tela'),
  ('Confección', 'Ensamble y costura de las piezas cortadas'),
  ('Terminado', 'Acabados: botones, ojales, planchado'),
  ('Empaque', 'Doblado y empaque final para entrega')
on conflict do nothing;

insert into tallas (codigo, orden) values
  ('XS', 1),
  ('S', 2),
  ('M', 3),
  ('L', 4),
  ('XL', 5),
  ('XXL', 6)
on conflict (codigo) do nothing;
