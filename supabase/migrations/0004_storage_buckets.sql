-- Buckets de Storage para evidencia fotográfica
insert into storage.buckets (id, name, public)
values
  ('evidencia-avance', 'evidencia-avance', false),
  ('evidencia-entrega', 'evidencia-entrega', false),
  ('modelos-imagenes', 'modelos-imagenes', true)
on conflict (id) do nothing;

-- evidencia-avance: cualquier autenticado sube (colaborador adjunta foto a su
-- propia captura); cualquier autenticado lee (gestión y compañeros de siguiente etapa
-- pueden necesitar verla)
create policy "autenticados_suben_evidencia_avance"
  on storage.objects for insert
  with check (bucket_id = 'evidencia-avance' and auth.role() = 'authenticated');

create policy "autenticados_leen_evidencia_avance"
  on storage.objects for select
  using (bucket_id = 'evidencia-avance' and auth.role() = 'authenticated');

-- evidencia-entrega: solo admin/ventas suben y leen
create policy "admin_ventas_suben_evidencia_entrega"
  on storage.objects for insert
  with check (bucket_id = 'evidencia-entrega' and fn_rol_actual() in ('admin','ventas'));

create policy "admin_ventas_leen_evidencia_entrega"
  on storage.objects for select
  using (bucket_id = 'evidencia-entrega' and fn_rol_actual() in ('admin','ventas'));

-- modelos-imagenes: público de lectura, solo admin/supervisor suben
create policy "publico_lee_modelos_imagenes"
  on storage.objects for select
  using (bucket_id = 'modelos-imagenes');

create policy "admin_supervisor_suben_modelos_imagenes"
  on storage.objects for insert
  with check (bucket_id = 'modelos-imagenes' and fn_rol_actual() in ('admin','supervisor'));
