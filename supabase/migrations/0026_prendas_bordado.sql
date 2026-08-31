-- Control de prendas que los clientes traen a la tienda física para
-- bordarles algo -- independiente de la producción propia del taller.
-- Flujo: recibida_en_tienda -> recogida_para_bordar -> bordada ->
-- regresada_a_tienda, cada transición guarda quién y cuándo.
create type estatus_prenda_bordado as enum (
  'recibida_en_tienda',
  'recogida_para_bordar',
  'bordada',
  'regresada_a_tienda'
);

create table prendas_bordado (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  descripcion text not null,
  cliente_nombre text not null,
  cliente_telefono text,
  fecha_entrega_compromiso date not null,
  estatus estatus_prenda_bordado not null default 'recibida_en_tienda',
  recibida_por uuid not null references perfiles(id),
  fecha_recibida timestamptz not null default now(),
  recogida_por uuid references perfiles(id),
  fecha_recogida timestamptz,
  bordada_por uuid references perfiles(id),
  fecha_bordada timestamptz,
  regresada_por uuid references perfiles(id),
  fecha_regresada timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_prendas_bordado_estatus on prendas_bordado(estatus);
-- folio ya tiene su propio índice por la restricción unique; no se crea uno aparte.

-- Uno o más bordados por prenda (ej. logo en el pecho + nombre en la manga).
create table detalles_bordado (
  id uuid primary key default gen_random_uuid(),
  prenda_id uuid not null references prendas_bordado(id) on delete cascade,
  ubicacion text not null,
  tipo text not null,
  descripcion text not null,
  created_at timestamptz not null default now()
);

create index idx_detalles_bordado_prenda on detalles_bordado(prenda_id);

-- Primer uso de updated_at en el esquema (ninguna otra tabla lo tenía) --
-- función genérica y reutilizable para futuras tablas que también lo
-- necesiten, no algo hecho a la medida solo de prendas_bordado. security
-- definer + search_path fijo, igual que las demás funciones de trigger del
-- esquema (fn_validar_y_acumular_avance, fn_descontar_unidad_material, etc.).
create or replace function fn_actualizar_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_actualizar_updated_at_prendas_bordado
  before update on prendas_bordado
  for each row execute function fn_actualizar_updated_at();

-- RLS: a diferencia de las tablas de producción/ventas (donde solo roles de
-- gestión escriben), aquí los 4 roles -- incluido colaborador -- pueden leer
-- y capturar, porque quien recoge/borda/regresa la prenda suele tener rol
-- colaborador y necesita marcarlo desde /bordado en (piso). Se sigue el
-- mismo patrón fn_rol_actual() del resto del esquema en vez de
-- auth.role() = 'authenticated' (que daría acceso a cualquier sesión válida,
-- tenga o no un perfil real). select/insert/update quedan abiertos a los 4
-- roles; delete se separa y se restringe a admin/supervisor para que nadie
-- pueda borrar el historial de una prenda por accidente.
alter table prendas_bordado enable row level security;

create policy "colaboradores_leen_prendas_bordado" on prendas_bordado for select
  using (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "colaboradores_insertan_prendas_bordado" on prendas_bordado for insert
  with check (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "colaboradores_actualizan_prendas_bordado" on prendas_bordado for update
  using (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'))
  with check (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "admin_supervisor_borran_prendas_bordado" on prendas_bordado for delete
  using (fn_rol_actual() in ('admin','supervisor'));

alter table detalles_bordado enable row level security;

create policy "colaboradores_leen_detalles_bordado" on detalles_bordado for select
  using (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "colaboradores_insertan_detalles_bordado" on detalles_bordado for insert
  with check (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "colaboradores_actualizan_detalles_bordado" on detalles_bordado for update
  using (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'))
  with check (fn_rol_actual() in ('admin','ventas','supervisor','colaborador'));

create policy "admin_supervisor_borran_detalles_bordado" on detalles_bordado for delete
  using (fn_rol_actual() in ('admin','supervisor'));
