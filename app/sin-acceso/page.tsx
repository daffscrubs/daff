import { BotonSalir } from "@/components/layout/BotonSalir";

// A donde llega alguien a quien le quitaron todos los permisos de pantallas.
export default function SinAccesoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Sin acceso</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu usuario no tiene pantallas habilitadas. Pídele al administrador que te asigne permisos en Ajustes.
      </p>
      <BotonSalir />
    </div>
  );
}
