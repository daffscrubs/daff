import { FormNuevaPrenda } from "@/components/bordados/FormNuevaPrenda";

export default function NuevaPrendaBordadoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nueva prenda para bordar</h1>
        <p className="text-muted-foreground">Registra la prenda que trajo el cliente y lo que se le va a bordar.</p>
      </div>
      <FormNuevaPrenda />
    </div>
  );
}
