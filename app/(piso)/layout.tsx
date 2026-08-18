import Image from "next/image";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { NavPiso } from "@/components/layout/NavPiso";
import { BotonSalir } from "@/components/layout/BotonSalir";

export default async function PisoLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 pb-16">
      <header className="flex items-center justify-between bg-primary px-4 py-4 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/logo-mark-white.png" alt="daff" width={28} height={28} priority />
          <div>
            <p className="text-base font-semibold">Hola, {perfil.nombre_completo.split(" ")[0]} 👋</p>
            <p className="text-xs text-primary-foreground/80 capitalize">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <BotonSalir />
      </header>
      <main className="flex-1 p-4">{children}</main>
      <NavPiso />
    </div>
  );
}
