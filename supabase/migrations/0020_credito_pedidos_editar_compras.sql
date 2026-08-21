-- Pedidos a crédito: días de plazo para cobrar, y registro de abonos/pagos
-- para poder calcular cuánto queda pendiente por cobrar de cada pedido.
alter table pedidos add column dias_credito integer not null default 0;

create table pagos_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  monto numeric(10,2) not null check (monto > 0),
  fecha date not null default current_date,
  notas text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create index idx_pagos_pedido_pedido on pagos_pedido(pedido_id);

alter table pagos_pedido enable row level security;

create policy "admin_ventas_gestionan_pagos_pedido" on pagos_pedido for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));

create policy "supervisor_lee_pagos_pedido" on pagos_pedido for select
  using (fn_rol_actual() = 'supervisor');

-- Ligar movimientos de inventario a la compra que los generó, para poder
-- revertirlos correctamente si la compra se edita o se elimina (antes no
-- había forma de saber qué movimientos venían de qué compra).
alter table movimientos_inventario add column compra_id uuid references compras(id) on delete set null;

create index idx_movimientos_inventario_compra on movimientos_inventario(compra_id);
