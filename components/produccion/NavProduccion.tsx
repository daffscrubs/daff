"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pestañas de Producción: órdenes, maquileros y (solo para quien ve montos) pagos.
export function NavProduccion({ puedeVerPagos }: { puedeVerPagos: boolean }) {
  const pathname = usePathname();
  const secciones = [
    { href: "/produccion", etiqueta: "Órdenes", activa: pathname === "/produccion" },
    { href: "/produccion/maquileros", etiqueta: "Maquileros", activa: pathname.startsWith("/produccion/maquileros") },
    ...(puedeVerPagos ? [{ href: "/produccion/pagos", etiqueta: "Pagos", activa: pathname.startsWith("/produccion/pagos") }] : []),
  ];
  return (
    <nav className="flex gap-1 border-b" aria-label="Producción">
      {secciones.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.activa ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            s.activa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {s.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
