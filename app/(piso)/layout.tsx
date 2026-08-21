import Image from "next/image";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { NavPiso } from "@/components/layout/NavPiso";
import { BotonSalir } from "@/components/layout/BotonSalir";

export default async function PisoLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 pb-16">
      <header className="bg-primary px-4 py-4 text-primary-foreground">
        <div className="mb-3 flex justify-center">
          <Image src="/brand/logo-full-white.png" alt="daff" width={56} height={76} priority />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">Hola, {perfil.nombre_completo.split(" ")[0]} 👋</p>
            <p className="text-xs text-primary-foreground/80 capitalize">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <BotonSalir />
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
      <NavPiso />
    </div>
  );
}
