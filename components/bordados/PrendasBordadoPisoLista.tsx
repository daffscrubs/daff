"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ESTATUS_PRENDA_BORDADO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PRENDA_BORDADO } from "@/lib/estatus-colores";
import { formatearFechaSolo } from "@/lib/fechas";
import { SIGUIENTE_ACCION_PRENDA } from "@/lib/bordados/siguiente-accion";
import type { Database } from "@/types/database.types";

type PrendaBordado = Database["public"]["Tables"]["prendas_bordado"]["Row"];

function TarjetaPrenda({ prenda }: { prenda: PrendaBordado }) {
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const siguiente = SIGUIENTE_ACCION_PRENDA[prenda.estatus];
  if (!siguiente) return null;

  function ejecutar() {
    if (!siguiente) return;
    startTransition(async () => {
      const res = await siguiente.accion(prenda.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prenda actualizada");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{prenda.descripcion}</p>
            <p className="text-sm text-muted-foreground">{prenda.cliente_nombre}</p>
          </div>
          <Badge className={CLASE_ESTATUS_PRENDA_BORDADO[prenda.estatus]}>
            {ESTATUS_PRENDA_BORDADO_LABEL[prenda.estatus]}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{prenda.folio}</span>
          <span>Entrega: {formatearFechaSolo(prenda.fecha_entrega_compromiso)}</span>
        </div>
        <Button className="w-full" disabled={pendiente} onClick={ejecutar}>
          {siguiente.etiqueta}
        </Button>
      </CardContent>
    </Card>
  );
}

// Sin escáner a la mano (o si falla), esta lista deja marcar el siguiente
// paso de cualquier prenda directamente -- mismo respaldo que ya tiene el
// listado de admin. Solo se muestran las que todavía tienen un paso
// pendiente; una vez "regresada_a_tienda" ya no hay nada que marcar aquí.
export function PrendasBordadoPisoLista({ prendas }: { prendas: PrendaBordado[] }) {
  const pendientes = prendas.filter((p) => SIGUIENTE_ACCION_PRENDA[p.estatus] !== null);

  if (!pendientes.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <PackageSearch className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No hay prendas pendientes de bordar en este momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendientes.map((p) => (
        <TarjetaPrenda key={p.id} prenda={p} />
      ))}
    </div>
  );
}
