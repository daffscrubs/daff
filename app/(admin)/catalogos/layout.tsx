"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/catalogos/tallas", label: "Tallas" },
  { href: "/catalogos/plantillas", label: "Plantillas" },
];

export default function CatalogosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogos</h1>
        <p className="text-muted-foreground">Tallas y plantillas.</p>
      </div>
      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
              pathname.startsWith(tab.href) && "border-primary text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
