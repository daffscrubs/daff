"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import {
  obtenerPrendaPorFolio,
  type PrendaBordadoConDetalles,
} from "@/actions/prendasBordado.actions";
import { EscanerQRDialog } from "@/components/ui/escaner-qr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ESTATUS_PRENDA_BORDADO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PRENDA_BORDADO } from "@/lib/estatus-colores";
import { SIGUIENTE_ACCION_PRENDA } from "@/lib/bordados/siguiente-accion";

export function EscanearPrendaDialog({ className }: { className?: string } = {}) {
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
    const siguiente = SIGUIENTE_ACCION_PRENDA[resultado.prenda.estatus];
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

  const siguiente = resultado ? SIGUIENTE_ACCION_PRENDA[resultado.prenda.estatus] : null;

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setEscanerAbierto(true)}>
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
