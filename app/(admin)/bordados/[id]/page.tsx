import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ESTATUS_PRENDA_BORDADO_LABEL, TIPO_BORDADO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PRENDA_BORDADO } from "@/lib/estatus-colores";
import { formatearFechaSolo, formatearFechaHora } from "@/lib/fechas";

export default async function DetallePrendaBordadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: prenda }, { data: detalles }] = await Promise.all([
    supabase.from("prendas_bordado").select("*").eq("id", id).single(),
    supabase.from("detalles_bordado").select("*").eq("prenda_id", id).order("created_at"),
  ]);

  if (!prenda) notFound();

  // Los cuatro "quién" de la línea de tiempo son perfiles distintos (o el
  // mismo, si la misma persona recibió y recogió) -- se piden en un solo
  // IN en vez de 4 selects por fila.
  const idsPerfiles = [prenda.recibida_por, prenda.recogida_por, prenda.bordada_por, prenda.regresada_por].filter(
    (v): v is string => !!v
  );
  const { data: perfiles } = idsPerfiles.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", idsPerfiles)
    : { data: [] };
  const nombrePerfil = (perfilId: string | null) => perfiles?.find((p) => p.id === perfilId)?.nombre_completo ?? "—";

  const timeline = [
    { etiqueta: "Recibida en tienda", quien: nombrePerfil(prenda.recibida_por), fecha: prenda.fecha_recibida },
    { etiqueta: "Recogida para bordar", quien: nombrePerfil(prenda.recogida_por), fecha: prenda.fecha_recogida },
    { etiqueta: "Bordada", quien: nombrePerfil(prenda.bordada_por), fecha: prenda.fecha_bordada },
    { etiqueta: "Regresada a tienda", quien: nombrePerfil(prenda.regresada_por), fecha: prenda.fecha_regresada },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{prenda.folio}</h1>
          <p className="text-muted-foreground">{prenda.descripcion}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={CLASE_ESTATUS_PRENDA_BORDADO[prenda.estatus]}>
            {ESTATUS_PRENDA_BORDADO_LABEL[prenda.estatus]}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/pdf/prendas-bordado/${id}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Ticket
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="font-medium">{prenda.cliente_nombre}</p>
          {prenda.cliente_telefono && <p className="text-sm text-muted-foreground">{prenda.cliente_telefono}</p>}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Fecha de entrega comprometida</p>
          <p className="font-medium">{formatearFechaSolo(prenda.fecha_entrega_compromiso)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Bordados</h2>
        <ul className="space-y-2">
          {(detalles ?? []).map((d) => (
            <li key={d.id} className="rounded-lg border p-3 text-sm">
              <span className="font-medium">{d.ubicacion}</span> · {TIPO_BORDADO_LABEL[d.tipo] ?? d.tipo}:{" "}
              {d.descripcion}
            </li>
          ))}
          {!detalles?.length && <p className="text-sm text-muted-foreground">Sin bordados registrados.</p>}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Línea de tiempo</h2>
        <ul className="space-y-2">
          {timeline.map((t) => (
            <li key={t.etiqueta} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{t.etiqueta}</p>
                {t.fecha && <p className="text-muted-foreground">{t.quien}</p>}
              </div>
              <p className="text-muted-foreground">{t.fecha ? formatearFechaHora(t.fecha) : "Pendiente"}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
