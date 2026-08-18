import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { NavPiso } from "@/components/layout/NavPiso";
import { BotonSalir } from "@/components/layout/BotonSalir";

export default async function PisoLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil();

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Hola, {perfil.nombre_completo.split(" ")[0]}</p>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <BotonSalir />
      </header>
      <main className="flex-1 p-4">{children}</main>
      <NavPiso />
    </div>
  );
}
