-- Row Level Security: autorización por rol
create or replace function fn_rol_actual()
returns rol_usuario
language sql
security definer
stable
set search_path = public
as $$
  select rol from perfiles where id = auth.uid();
$$;

-- =========================================================
-- perfiles
-- =========================================================
alter table perfiles enable row level security;

create policy "usuarios_leen_su_propio_perfil"
  on perfiles for select
  using (id = auth.uid() or fn_rol_actual() = 'admin');

create policy "admin_gestiona_perfiles"
  on perfiles for all
  using (fn_rol_actual() = 'admin')
  with check (fn_rol_actual() = 'admin');

-- =========================================================
-- catálogos de solo lectura amplia (modelos, tallas, variantes, etapas_proceso,
-- plantillas, clientes, pedidos, items_pedido) — patrón: gestión por rol,
-- lectura amplia para autenticados donde el colaborador necesita ver el catálogo
-- =========================================================

-- clientes: gestión admin/ventas, lectura supervisor
alter table clientes enable row level security;
create policy "admin_ventas_gestionan_clientes" on clientes for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_clientes" on clientes for select
  using (fn_rol_actual() = 'supervisor');

-- pedidos: gestión admin/ventas, lectura supervisor
alter table pedidos enable row level security;
create policy "admin_ventas_gestionan_pedidos" on pedidos for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_pedidos" on pedidos for select
  using (fn_rol_actual() = 'supervisor');

-- items_pedido: sigue el mismo patrón que pedidos
alter table items_pedido enable row level security;
create policy "admin_ventas_gestionan_items_pedido" on items_pedido for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_items_pedido" on items_pedido for select
  using (fn_rol_actual() = 'supervisor');

-- catálogos (modelos, tallas, variantes, etapas_proceso, plantillas): gestión
-- admin/supervisor, lectura para cualquier usuario autenticado (colaborador
-- necesita ver modelos/tallas/etapas para navegar la captura de avance)
alter table modelos enable row level security;
create policy "admin_supervisor_gestionan_modelos" on modelos for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_modelos" on modelos for select
  using (auth.role() = 'authenticated');

alter table tallas enable row level security;
create policy "admin_supervisor_gestionan_tallas" on tallas for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_tallas" on tallas for select
  using (auth.role() = 'authenticated');

alter table variantes enable row level security;
create policy "admin_supervisor_gestionan_variantes" on variantes for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_variantes" on variantes for select
  using (auth.role() = 'authenticated');

alter table etapas_proceso enable row level security;
create policy "admin_gestiona_etapas_proceso" on etapas_proceso for all
  using (fn_rol_actual() = 'admin')
  with check (fn_rol_actual() = 'admin');
create policy "autenticados_leen_etapas_proceso" on etapas_proceso for select
  using (auth.role() = 'authenticated');

alter table plantillas_pedido enable row level security;
create policy "admin_ventas_gestionan_plantillas" on plantillas_pedido for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_plantillas" on plantillas_pedido for select
  using (fn_rol_actual() = 'supervisor');

alter table plantilla_items enable row level security;
create policy "admin_ventas_gestionan_plantilla_items" on plantilla_items for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_plantilla_items" on plantilla_items for select
  using (fn_rol_actual() = 'supervisor');

-- =========================================================
-- producción: lotes, lote_etapas — gestión admin/supervisor, lectura amplia
-- =========================================================
alter table lotes_produccion enable row level security;
create policy "admin_supervisor_gestionan_lotes" on lotes_produccion for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_lotes" on lotes_produccion for select
  using (auth.role() = 'authenticated');

alter table lote_etapas enable row level security;
create policy "admin_supervisor_gestionan_lote_etapas" on lote_etapas for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_lote_etapas" on lote_etapas for select
  using (auth.role() = 'authenticated');

-- =========================================================
-- registros_avance_colaborador: el núcleo de autorización
-- =========================================================
alter table registros_avance_colaborador enable row level security;

-- colaborador inserta solo su propio avance normal (nunca ajustes, nunca a nombre de otro)
create policy "colaborador_inserta_su_avance" on registros_avance_colaborador for insert
  with check (
    origen = 'colaborador'
    and colaborador_id = auth.uid()
    and registrado_por = auth.uid()
    and cantidad > 0
  );

-- admin/supervisor insertan ajustes (positivos o negativos) a nombre de cualquier colaborador
create policy "supervisor_inserta_ajustes" on registros_avance_colaborador for insert
  with check (
    origen = 'ajuste_supervisor'
    and fn_rol_actual() in ('admin','supervisor')
    and registrado_por = auth.uid()
  );

-- lectura: el colaborador ve solo lo suyo; roles de gestión ven todo
create policy "colaborador_lee_su_avance" on registros_avance_colaborador for select
  using (
    colaborador_id = auth.uid()
    or fn_rol_actual() in ('admin','ventas','supervisor')
  );

-- sin políticas de update/delete: el historial de avance es inmutable por diseño

-- =========================================================
-- incidencias_produccion: cualquier autenticado reporta, gestión ve todo
-- =========================================================
alter table incidencias_produccion enable row level security;
create policy "autenticados_reportan_incidencias" on incidencias_produccion for insert
  with check (reportado_por = auth.uid());
create policy "autenticados_leen_incidencias" on incidencias_produccion for select
  using (auth.role() = 'authenticated');
create policy "admin_supervisor_actualizan_incidencias" on incidencias_produccion for update
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));

-- =========================================================
-- materiales e inventario: gestión admin/supervisor
-- =========================================================
alter table materiales enable row level security;
create policy "admin_supervisor_gestionan_materiales" on materiales for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_materiales" on materiales for select
  using (auth.role() = 'authenticated');

alter table movimientos_inventario enable row level security;
create policy "admin_supervisor_gestionan_movimientos" on movimientos_inventario for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_movimientos" on movimientos_inventario for select
  using (auth.role() = 'authenticated');

alter table consumo_material_orden enable row level security;
create policy "admin_supervisor_gestionan_consumo" on consumo_material_orden for all
  using (fn_rol_actual() in ('admin','supervisor'))
  with check (fn_rol_actual() in ('admin','supervisor'));
create policy "autenticados_leen_consumo" on consumo_material_orden for select
  using (auth.role() = 'authenticated');

-- =========================================================
-- entregas: gestión admin/ventas, lectura supervisor
-- =========================================================
alter table entregas enable row level security;
create policy "admin_ventas_gestionan_entregas" on entregas for all
  using (fn_rol_actual() in ('admin','ventas'))
  with check (fn_rol_actual() in ('admin','ventas'));
create policy "supervisor_lee_entregas" on entregas for select
  using (fn_rol_actual() = 'supervisor');
