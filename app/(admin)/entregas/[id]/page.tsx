import { notFound } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormEntregaReal } from "@/components/entregas/FormEntregaReal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ESTATUS_ENTREGA_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_ENTREGA } from "@/lib/estatus-colores";

export default async function EntregaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entrega } = await supabase.from("entregas").select("*, pedidos(folio, cliente_id)").eq("id", id).single();
  if (!entrega) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Entrega de{" "}
            <Link href={`/pedidos/${entrega.pedido_id}`} className="hover:underline">
              {entrega.pedidos?.folio}
            </Link>
          </h1>
          <p className="text-muted-foreground">Programada: {entrega.fecha_programada}</p>
        </div>
        <div className="flex items-center gap-2">
          {entrega.estatus === "entregada" && (
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/api/pdf/entregas/${id}`} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <Download className="size-4" />
              Descargar PDF
            </Button>
          )}
          <Badge className={CLASE_ESTATUS_ENTREGA[entrega.estatus]}>{ESTATUS_ENTREGA_LABEL[entrega.estatus]}</Badge>
        </div>
      </div>

      {entrega.estatus === "entregada" ? (
        <div className="max-w-md space-y-1 rounded-lg border p-4">
          <p><span className="text-muted-foreground">Recibido por:</span> {entrega.recibido_por}</p>
          <p><span className="text-muted-foreground">Fecha real:</span> {entrega.fecha_real ? new Date(entrega.fecha_real).toLocaleString("es-MX") : "—"}</p>
          {entrega.notas && <p><span className="text-muted-foreground">Notas:</span> {entrega.notas}</p>}
        </div>
      ) : (
        <FormEntregaReal entregaId={id} pedidoId={entrega.pedido_id} />
      )}
    </div>
  );
}
