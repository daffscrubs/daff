// Permisos por usuario. El rol 'admin' tiene acceso completo siempre; los demás usuarios solo lo que
// tengan marcado en perfiles.permisos (se edita en Ajustes). Este archivo es el catálogo único: lo
// usan el menú, el proxy que protege las rutas y la pantalla de Ajustes. Las operaciones de dinero e
// inventario (vender, cancelar, caja) además validan el permiso dentro de la base de datos.
//
// IMPORTANTE: PERMISOS_POR_ROL debe coincidir con fn_permisos_por_rol de la migración 0030 (hay una
// prueba que lo comprueba).

export type RolUsuarioBase = "admin" | "ventas" | "supervisor" | "colaborador";

export interface DefinicionPermiso {
  id: string;
  etiqueta: string;
}

export interface GrupoPermisos {
  id: string;
  titulo: string;
  permisos: DefinicionPermiso[];
}

export const GRUPOS_PERMISOS: GrupoPermisos[] = [
  {
    id: "pos",
    titulo: "Punto de venta",
    permisos: [
      { id: "modulo.pos", etiqueta: "Acceder al punto de venta y vender" },
      { id: "pos.descuentos", etiqueta: "Aplicar descuentos" },
      { id: "pos.sin_existencias", etiqueta: "Vender sin existencias" },
      { id: "pos.entrada_manual", etiqueta: "Agregar productos con entrada manual (precio libre)" },
      { id: "pos.ver_ventas", etiqueta: "Ver las ventas del día" },
      { id: "pos.cancelar", etiqueta: "Cancelar ventas" },
    ],
  },
  {
    id: "caja",
    titulo: "Caja",
    permisos: [
      { id: "modulo.caja", etiqueta: "Acceder a caja" },
      { id: "caja.abrir_cerrar", etiqueta: "Abrir y cerrar caja" },
      { id: "caja.ingresos", etiqueta: "Registrar ingresos de efectivo" },
      { id: "caja.retiros", etiqueta: "Registrar retiros de efectivo" },
    ],
  },
  {
    id: "modulos",
    titulo: "Acceso a módulos",
    permisos: [
      { id: "modulo.dashboard", etiqueta: "Dashboard" },
      { id: "modulo.clientes", etiqueta: "Clientes" },
      { id: "modulo.pedidos", etiqueta: "Pedidos" },
      { id: "modulo.produccion", etiqueta: "Producción" },
      { id: "modulo.inventario", etiqueta: "Inventario" },
      { id: "modulo.catalogos", etiqueta: "Catálogos" },
      { id: "modulo.materiales", etiqueta: "Materiales" },
      { id: "modulo.compras", etiqueta: "Compras" },
      { id: "modulo.bordados", etiqueta: "Bordados" },
      { id: "modulo.reportes", etiqueta: "Reportes" },
    ],
  },
];

export const TODOS_LOS_PERMISOS: string[] = GRUPOS_PERMISOS.flatMap((g) => g.permisos.map((p) => p.id));

// Lo que cada rol recibe al crearse (y lo que ya veía antes de existir los permisos por usuario).
export const PERMISOS_POR_ROL: Record<RolUsuarioBase, string[]> = {
  admin: [],
  ventas: [
    "modulo.dashboard", "modulo.clientes", "modulo.pedidos", "modulo.compras", "modulo.bordados", "modulo.reportes",
    "modulo.pos", "modulo.caja", "pos.ver_ventas", "pos.entrada_manual", "caja.abrir_cerrar", "caja.ingresos",
  ],
  supervisor: [
    "modulo.dashboard", "modulo.produccion", "modulo.inventario", "modulo.catalogos", "modulo.materiales",
    "modulo.compras", "modulo.bordados", "modulo.reportes",
    "modulo.pos", "modulo.caja", "pos.ver_ventas", "pos.entrada_manual", "pos.descuentos", "pos.cancelar",
    "caja.abrir_cerrar", "caja.ingresos", "caja.retiros",
  ],
  colaborador: [],
};

export interface PerfilConPermisos {
  rol: RolUsuarioBase;
  permisos: string[];
}

export function tienePermiso(perfil: PerfilConPermisos, permiso: string): boolean {
  return perfil.rol === "admin" || perfil.permisos.includes(permiso);
}

// Pantallas del panel y el permiso que pide cada una, en el orden en que se ofrecen como inicio.
// "admin" = solo el administrador (no se puede otorgar).
const RUTAS: { prefijo: string; permiso: string }[] = [
  { prefijo: "/dashboard", permiso: "modulo.dashboard" },
  { prefijo: "/pos", permiso: "modulo.pos" },
  { prefijo: "/caja", permiso: "modulo.caja" },
  { prefijo: "/clientes", permiso: "modulo.clientes" },
  { prefijo: "/pedidos", permiso: "modulo.pedidos" },
  { prefijo: "/produccion", permiso: "modulo.produccion" },
  { prefijo: "/inventario", permiso: "modulo.inventario" },
  { prefijo: "/catalogos", permiso: "modulo.catalogos" },
  { prefijo: "/materiales", permiso: "modulo.materiales" },
  { prefijo: "/compras", permiso: "modulo.compras" },
  { prefijo: "/bordados", permiso: "modulo.bordados" },
  { prefijo: "/reportes", permiso: "modulo.reportes" },
  { prefijo: "/usuarios", permiso: "admin" },
  { prefijo: "/ajustes", permiso: "admin" },
];

/** Permiso que pide una ruta, o null si la ruta no está restringida por permisos. */
export function permisoDeRuta(pathname: string): string | null {
  // Se compara por segmento completo: "/bordado" (piso) no es "/bordados" (panel).
  const ruta = RUTAS.find((r) => pathname === r.prefijo || pathname.startsWith(r.prefijo + "/"));
  return ruta?.permiso ?? null;
}

export function puedeEntrarARuta(perfil: PerfilConPermisos, pathname: string): boolean {
  const permiso = permisoDeRuta(pathname);
  if (permiso === null) return true;
  if (permiso === "admin") return perfil.rol === "admin";
  return tienePermiso(perfil, permiso);
}

/** Primera pantalla a la que puede entrar el usuario (donde cae al iniciar sesión o si pide una prohibida). */
export function rutaInicial(perfil: PerfilConPermisos): string {
  if (perfil.rol === "colaborador") return "/mi-dia";
  const primera = RUTAS.find((r) => r.permiso !== "admin" && tienePermiso(perfil, r.permiso));
  return primera?.prefijo ?? "/sin-acceso";
}
