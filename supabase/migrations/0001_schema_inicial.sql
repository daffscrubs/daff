-- Esquema inicial: taller de producción de ropa médica
create extension if not exists pgcrypto;

-- =========================================================
-- Usuarios y roles
-- =========================================================
create type rol_usuario as enum ('admin', 'ventas', 'supervisor', 'colaborador');

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol rol_usuario not null default 'colaborador',
  usuario_corto text unique,
  activo boolean not null default true,
  telefono text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Módulo 1: clientes
-- =========================================================
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text,
  rfc text,
  contacto_nombre text,
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Módulo 3: catálogos de soporte (modelos, tallas, variantes, plantillas)
-- =========================================================
create table modelos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  imagen_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table tallas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  orden smallint not null
);

create table variantes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos(id) on delete cascade,
  color text,
  tela text,
  diseno text,
  sku text unique,
  created_at timestamptz not null default now()
);

create table plantillas_pedido (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table plantilla_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references plantillas_pedido(id) on delete cascade,
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  cantidad_sugerida integer
);

-- =========================================================
-- Módulo 1 (cont.): pedidos
-- =========================================================
create type estatus_pedido as enum ('cotizacion', 'confirmado', 'en_produccion', 'listo', 'entregado', 'cancelado');

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  folio text unique not null,
  fecha_pedido date not null default current_date,
  fecha_compromiso date not null,
  estatus estatus_pedido not null default 'confirmado',
  creado_por uuid references perfiles(id),
  notas text,
  created_at timestamptz not null default now()
);

create table items_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(10,2),
  notas text
);

-- =========================================================
-- Módulo 2 + trazabilidad de colaboradores por proceso
-- =========================================================
create table etapas_proceso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activo boolean not null default true
);

create type estatus_orden as enum ('planeada', 'en_proceso', 'terminada', 'cancelada');

create table lotes_produccion (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null,
  pedido_id uuid references pedidos(id),
  modelo_id uuid not null references modelos(id),
  talla_id uuid not null references tallas(id),
  variante_id uuid references variantes(id),
  cantidad_planeada integer not null check (cantidad_planeada > 0),
  estatus estatus_orden not null default 'planeada',
  fecha_inicio date,
  fecha_fin_estimada date,
  fecha_fin_real date,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create table lote_etapas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id) on delete cascade,
  etapa_id uuid not null references etapas_proceso(id),
  orden_secuencia smallint not null,
  cantidad_completada integer not null default 0,
  estatus text not null default 'pendiente',
  unique (lote_id, orden_secuencia),
  unique (lote_id, etapa_id)
);

create type origen_avance as enum ('colaborador', 'ajuste_supervisor');

create table registros_avance_colaborador (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references perfiles(id),
  registrado_por uuid not null references perfiles(id),
  lote_id uuid not null references lotes_produccion(id),
  lote_etapa_id uuid not null references lote_etapas(id),
  origen origen_avance not null default 'colaborador',
  cantidad integer not null check (cantidad <> 0),
  fecha date not null default current_date,
  observaciones text,
  foto_url text,
  created_at timestamptz not null default now()
);

create table incidencias_produccion (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id),
  lote_etapa_id uuid references lote_etapas(id),
  reportado_por uuid references perfiles(id),
  descripcion text not null,
  gravedad text not null default 'baja',
  foto_url text,
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Módulo 4: materiales e inventario
-- =========================================================
create table materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  unidad_medida text not null,
  stock_actual numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  costo_unitario numeric(10,2),
  created_at timestamptz not null default now()
);

create type tipo_movimiento as enum ('entrada', 'salida', 'ajuste');

create table movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales(id),
  tipo tipo_movimiento not null,
  cantidad numeric(12,2) not null,
  lote_id uuid references lotes_produccion(id),
  motivo text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create table consumo_material_orden (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes_produccion(id),
  material_id uuid not null references materiales(id),
  cantidad_estimada numeric(12,2),
  cantidad_real numeric(12,2) not null default 0,
  unique (lote_id, material_id)
);

-- =========================================================
-- Módulo 5: entregas
-- =========================================================
create type estatus_entrega as enum ('programada', 'en_ruta', 'entregada', 'cancelada');

create table entregas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id),
  fecha_programada date not null,
  fecha_real timestamptz,
  estatus estatus_entrega not null default 'programada',
  recibido_por text,
  firma_url text,
  notas text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Índices de apoyo
-- =========================================================
create index idx_pedidos_cliente on pedidos(cliente_id);
create index idx_items_pedido_pedido on items_pedido(pedido_id);
create index idx_lotes_pedido on lotes_produccion(pedido_id);
create index idx_lote_etapas_lote on lote_etapas(lote_id);
create index idx_registros_avance_lote on registros_avance_colaborador(lote_id);
create index idx_registros_avance_colaborador on registros_avance_colaborador(colaborador_id);
create index idx_registros_avance_lote_etapa on registros_avance_colaborador(lote_etapa_id);
create index idx_movimientos_material on movimientos_inventario(material_id);
create index idx_entregas_pedido on entregas(pedido_id);
