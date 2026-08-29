"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shirt } from "lucide-react";
import { marcarRecogida, marcarBordada, marcarRegresada } from "@/actions/prendasBordado.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ESTATUS_PRENDA_BORDADO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PRENDA_BORDADO } from "@/lib/estatus-colores";
import { formatearFechaSolo } from "@/lib/fechas";
import type { AccionResultado } from "@/lib/tipos/accion";
import type { Database, EstatusPrendaBordado } from "@/types/database.types";

type PrendaBordado = Database["public"]["Tables"]["prendas_bordado"]["Row"];

// La acción disponible por fila depende solo del estatus actual -- mismo
// mapeo que ya usa EscanearPrendaDialog para no duplicar la regla en dos
// sitios con criterios distintos.
const SIGUIENTE_ACCION: Record<EstatusPrendaBordado, { etiqueta: string; accion: (id: string) => Promise<AccionResultado> } | null> = {
  recibida_en_tienda: { etiqueta: "Marcar recogida", accion: marcarRecogida },
  recogida_para_bordar: { etiqueta: "Marcar bordada", accion: marcarBordada },
  bordada: { etiqueta: "Marcar regresada", accion: marcarRegresada },
  regresada_a_tienda: null,
};

function FilaPrenda({ prenda }: { prenda: PrendaBordado }) {
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const siguiente = SIGUIENTE_ACCION[prenda.estatus];

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
    <TableRow className="cursor-pointer" onClick={() => router.push(`/bordados/${prenda.id}`)}>
      <TableCell className="font-mono text-xs">{prenda.folio}</TableCell>
      <TableCell>{prenda.descripcion}</TableCell>
      <TableCell>{prenda.cliente_nombre}</TableCell>
      <TableCell>{formatearFechaSolo(prenda.fecha_entrega_compromiso)}</TableCell>
      <TableCell>
        <Badge className={CLASE_ESTATUS_PRENDA_BORDADO[prenda.estatus]}>
          {ESTATUS_PRENDA_BORDADO_LABEL[prenda.estatus]}
        </Badge>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        {siguiente && (
          <Button size="sm" variant="outline" disabled={pendiente} onClick={ejecutar}>
            {siguiente.etiqueta}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function PrendasBordadoTable({ prendas }: { prendas: PrendaBordado[] }) {
  if (!prendas.length) {
    return (
      <EstadoVacio
        icon={Shirt}
        titulo="Sin prendas todavía"
        descripcion="Las prendas que registres para bordar van a aparecer aquí."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Folio</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Entrega</TableHead>
          <TableHead>Estatus</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {prendas.map((p) => (
          <FilaPrenda key={p.id} prenda={p} />
        ))}
      </TableBody>
    </Table>
  );
}
