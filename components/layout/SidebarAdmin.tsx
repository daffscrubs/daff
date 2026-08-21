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
  BarChart3,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types/database.types";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "ventas", "supervisor"] },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "ventas"] },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["admin", "ventas"] },
  { href: "/produccion", label: "Producción", icon: Factory, roles: ["admin", "supervisor"] },
  { href: "/inventario", label: "Inventario", icon: Package, roles: ["admin", "supervisor"] },
  { href: "/catalogos/tallas", label: "Catálogos", icon: BookOpen, roles: ["admin", "supervisor"] },
  { href: "/materiales", label: "Materiales", icon: Boxes, roles: ["admin", "supervisor"] },
  { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["admin", "supervisor", "ventas"] },
  { href: "/reportes/productividad", label: "Reportes", icon: BarChart3, roles: ["admin", "ventas", "supervisor"] },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: LucideIcon; roles: RolUsuario[] }>;

export function SidebarAdmin({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {ITEMS.filter((item) => (item.roles as readonly string[]).includes(rol)).map((item) => {
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
