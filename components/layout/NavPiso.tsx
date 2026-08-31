"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, History, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/mi-dia", label: "Mi día", icon: ListChecks },
  { href: "/bordado", label: "Bordado", icon: Shirt },
  { href: "/mi-historial", label: "Mi historial", icon: History },
];

export function NavPiso() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background/95 backdrop-blur">
      {ITEMS.map((item) => {
        const activo = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium",
              activo ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="size-5" strokeWidth={activo ? 2.5 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
