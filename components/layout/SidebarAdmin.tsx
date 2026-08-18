"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types/database.types";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "ventas", "supervisor"] },
  { href: "/clientes", label: "Clientes", roles: ["admin", "ventas"] },
  { href: "/pedidos", label: "Pedidos", roles: ["admin", "ventas"] },
  { href: "/produccion", label: "Producción", roles: ["admin", "supervisor"] },
  { href: "/catalogos/modelos", label: "Catálogos", roles: ["admin", "supervisor"] },
  { href: "/materiales", label: "Materiales", roles: ["admin", "supervisor"] },
  { href: "/entregas", label: "Entregas", roles: ["admin", "ventas"] },
  { href: "/reportes/productividad", label: "Reportes", roles: ["admin", "ventas", "supervisor"] },
  { href: "/usuarios", label: "Usuarios", roles: ["admin"] },
] as const satisfies ReadonlyArray<{ href: string; label: string; roles: RolUsuario[] }>;

export function SidebarAdmin({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {ITEMS.filter((item) => (item.roles as readonly string[]).includes(rol)).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
            pathname.startsWith(item.href) && "bg-muted text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
