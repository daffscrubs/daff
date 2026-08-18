import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { SidebarAdmin } from "@/components/layout/SidebarAdmin";
import { BotonSalir } from "@/components/layout/BotonSalir";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil(["admin", "ventas", "supervisor"]);

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r">
        <div className="border-b p-4">
          <p className="text-sm font-semibold">Taller de Ropa Médica</p>
          <p className="text-xs text-muted-foreground capitalize">{perfil.rol}</p>
        </div>
        <SidebarAdmin rol={perfil.rol} />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <p className="text-sm text-muted-foreground">{perfil.nombre_completo}</p>
          <BotonSalir />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
