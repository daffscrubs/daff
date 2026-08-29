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
create index idx_prendas_bordado_folio on prendas_bordado(folio);

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
-- necesiten, no algo hecho a la medida solo de prendas_bordado.
create or replace function fn_actualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_actualizar_updated_at_prendas_bordado
  before update on prendas_bordado
  for each row execute function fn_actualizar_updated_at();

-- RLS: a diferencia del resto de tablas operativas (donde solo admin/
-- supervisor escriben), aquí cualquier autenticado con perfil lee y
-- escribe -- lo pidió así explícitamente quien encargó esta tabla, sin
-- distinción de rol.
alter table prendas_bordado enable row level security;
create policy "autenticados_gestionan_prendas_bordado" on prendas_bordado for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table detalles_bordado enable row level security;
create policy "autenticados_gestionan_detalles_bordado" on detalles_bordado for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
