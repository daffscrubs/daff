-- Los materiales ya tenían "categoria" (libre, ej. "Tela", "Hilo"); los
-- modelos (productos) no tenían forma de agruparse por categoría.
alter table modelos add column categoria text;
