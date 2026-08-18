import Image from "next/image";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { SidebarAdmin } from "@/components/layout/SidebarAdmin";
import { BotonSalir } from "@/components/layout/BotonSalir";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  ventas: "Ventas",
  supervisor: "Supervisor",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil(["admin", "ventas", "supervisor"]);
  const iniciales = perfil.nombre_completo
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2.5 border-b px-4 py-4">
          <Image src="/brand/logo-mark.png" alt="daff" width={30} height={30} className="shrink-0" priority />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">daff</p>
            <p className="text-xs text-sidebar-foreground/60">{ROL_LABEL[perfil.rol] ?? perfil.rol}</p>
          </div>
        </div>
        <SidebarAdmin rol={perfil.rol} />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background px-6 py-3">
          <div />
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                {iniciales || "?"}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">{perfil.nombre_completo}</p>
            <BotonSalir />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
