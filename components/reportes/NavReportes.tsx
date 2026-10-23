"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/reportes/ventas", etiqueta: "Ventas" },
  { href: "/reportes/productividad", etiqueta: "Productividad" },
];

export function NavReportes() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b" aria-label="Reportes">
      {SECCIONES.map((s) => {
        const activo = pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activo ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
