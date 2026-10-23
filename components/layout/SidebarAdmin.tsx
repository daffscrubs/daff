"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Factory,
  BookOpen,
  Boxes,
  Package,
  ShoppingCart,
  Shirt,
  BarChart3,
  UserCog,
  Store,
  Landmark,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tienePermiso, type PerfilConPermisos } from "@/lib/permisos";

// "permiso": el que debe tener el usuario para ver la opción ("admin" = solo el administrador).
const ITEMS: { href: string; label: string; icon: LucideIcon; permiso: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permiso: "modulo.dashboard" },
  { href: "/pos", label: "Punto de venta", icon: Store, permiso: "modulo.pos" },
  { href: "/caja", label: "Caja", icon: Landmark, permiso: "modulo.caja" },
  { href: "/clientes", label: "Clientes", icon: Users, permiso: "modulo.clientes" },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, permiso: "modulo.pedidos" },
  { href: "/produccion", label: "Producción", icon: Factory, permiso: "modulo.produccion" },
  { href: "/inventario", label: "Inventario", icon: Package, permiso: "modulo.inventario" },
  { href: "/catalogos/tallas", label: "Catálogos", icon: BookOpen, permiso: "modulo.catalogos" },
  { href: "/materiales", label: "Materiales", icon: Boxes, permiso: "modulo.materiales" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, permiso: "modulo.compras" },
  { href: "/bordados", label: "Bordados", icon: Shirt, permiso: "modulo.bordados" },
  { href: "/reportes/productividad", label: "Reportes", icon: BarChart3, permiso: "modulo.reportes" },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, permiso: "admin" },
  { href: "/ajustes", label: "Ajustes", icon: Settings, permiso: "admin" },
];

export function SidebarAdmin({ perfil }: { perfil: PerfilConPermisos }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {ITEMS.filter((item) => (item.permiso === "admin" ? perfil.rol === "admin" : tienePermiso(perfil, item.permiso))).map((item) => {
        const activo = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              activo && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={activo ? 2.25 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
