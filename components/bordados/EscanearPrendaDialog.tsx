"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import {
  obtenerPrendaPorFolio,
  marcarRecogida,
  marcarBordada,
  marcarRegresada,
  type PrendaBordadoConDetalles,
} from "@/actions/prendasBordado.actions";
import { EscanerQRDialog } from "@/components/ui/escaner-qr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ESTATUS_PRENDA_BORDADO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PRENDA_BORDADO } from "@/lib/estatus-colores";
import type { AccionResultado } from "@/lib/tipos/accion";
import type { EstatusPrendaBordado } from "@/types/database.types";

// La siguiente acción disponible depende solo del estatus actual -- mismo
// orden que valida transicionarEstatusPrenda en el servidor. null significa
// "estatus final, no hay nada más que marcar".
const SIGUIENTE_ACCION: Record<EstatusPrendaBordado, { etiqueta: string; accion: (id: string) => Promise<AccionResultado> } | null> = {
  recibida_en_tienda: { etiqueta: "Marcar recogida para bordar", accion: marcarRecogida },
  recogida_para_bordar: { etiqueta: "Marcar bordada", accion: marcarBordada },
  bordada: { etiqueta: "Marcar regresada a tienda", accion: marcarRegresada },
  regresada_a_tienda: null,
};

export function EscanearPrendaDialog() {
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [resultado, setResultado] = useState<PrendaBordadoConDetalles | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function buscar(folio: string) {
    startTransition(async () => {
      const res = await obtenerPrendaPorFolio(folio);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEscanerAbierto(false);
      setResultado(res.data);
    });
  }

  function ejecutarSiguienteAccion() {
    if (!resultado) return;
    const siguiente = SIGUIENTE_ACCION[resultado.prenda.estatus];
    if (!siguiente) return;
    startTransition(async () => {
      const res = await siguiente.accion(resultado.prenda.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prenda actualizada");
      setResultado(null);
      router.refresh();
    });
  }

  const siguiente = resultado ? SIGUIENTE_ACCION[resultado.prenda.estatus] : null;

  return (
    <>
      <Button variant="outline" onClick={() => setEscanerAbierto(true)}>
        <QrCode className="size-4" />
        Escanear ticket
      </Button>

      <EscanerQRDialog
        abierto={escanerAbierto}
        onOpenChange={setEscanerAbierto}
        onDetectado={buscar}
        titulo="Escanear ticket de prenda"
      />

      <Dialog open={!!resultado} onOpenChange={(abierto) => !abierto && setResultado(null)}>
        <DialogContent>
          {resultado && (
            <>
              <DialogHeader>
                <DialogTitle>{resultado.prenda.folio}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{resultado.prenda.descripcion}</p>
                  <p className="text-sm text-muted-foreground">{resultado.prenda.cliente_nombre}</p>
                </div>
                <Badge className={CLASE_ESTATUS_PRENDA_BORDADO[resultado.prenda.estatus]}>
                  {ESTATUS_PRENDA_BORDADO_LABEL[resultado.prenda.estatus]}
                </Badge>
                {siguiente ? (
                  <Button className="w-full" disabled={pendiente} onClick={ejecutarSiguienteAccion}>
                    {siguiente.etiqueta}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Esta prenda ya se regresó a tienda.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
