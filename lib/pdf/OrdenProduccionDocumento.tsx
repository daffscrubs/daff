import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";
import { formatearFechaHora, formatearFechaSolo } from "@/lib/fechas";

export interface ItemOrdenPDF {
  producto: string;
  talla: string;
  pedido: number;
  entregado: number;
}

export interface InsumoOrdenPDF {
  material: string;
  cantidadEstimada: number | null;
  cantidadReal: number | null;
  unidad: string;
}

export interface EventoHistorialPDF {
  fecha: string;
  soloFecha?: boolean;
  titulo: string;
  detalle?: string;
}

export interface EntregaPDF {
  fecha: string;
  entrego: string;
  recibio: string;
  piezas: string;
  cancelada: boolean;
}

export interface OrdenProduccionPDFProps {
  folio: string;
  cliente: string | null;
  estatus: string;
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
  notas: string | null;
  items: ItemOrdenPDF[];
  /** "Interna" o "Maquila · nombre del maquilero" (sin montos: este PDF lo ve también ventas). */
  quienLaHace: string;
  insumos: InsumoOrdenPDF[];
  cronologia: EventoHistorialPDF[];
  entregas: EntregaPDF[];
}

export function OrdenProduccionDocumento({
  folio,
  cliente,
  estatus,
  fechaInicio,
  fechaFinEstimada,
  notas,
  items,
  quienLaHace,
  insumos,
  cronologia,
  entregas,
}: OrdenProduccionPDFProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado titulo="Orden de trabajo" folio={folio} />

        <View style={estilos.filaDatos}>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Cliente</Text>
            <Text style={estilos.valor}>{cliente ?? "—"}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Estatus</Text>
            <Text style={estilos.valor}>{estatus}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha de inicio</Text>
            <Text style={estilos.valor}>{fechaInicio ?? "—"}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha estimada de fin</Text>
            <Text style={estilos.valor}>{fechaFinEstimada ?? "—"}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>La hace</Text>
            <Text style={estilos.valor}>{quienLaHace}</Text>
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Productos a fabricar</Text>
          <View style={estilos.tabla}>
            <View style={estilos.filaEncabezadoTabla}>
              <Text style={[estilos.celdaEncabezado, { width: "40%" }]}>Producto</Text>
              <Text style={[estilos.celdaEncabezado, { width: "15%" }]}>Talla</Text>
              <Text style={[estilos.celdaEncabezado, { width: "15%", textAlign: "right" }]}>Pedido</Text>
              <Text style={[estilos.celdaEncabezado, { width: "15%", textAlign: "right" }]}>Entregado</Text>
              <Text style={[estilos.celdaEncabezado, { width: "15%", textAlign: "right" }]}>Pendiente</Text>
            </View>
            {items.map((item, i) => (
              <View key={i} style={estilos.filaTabla}>
                <Text style={[estilos.celda, { width: "40%" }]}>{item.producto}</Text>
                <Text style={[estilos.celda, { width: "15%" }]}>{item.talla}</Text>
                <Text style={[estilos.celda, { width: "15%", textAlign: "right" }]}>{item.pedido}</Text>
                <Text style={[estilos.celda, { width: "15%", textAlign: "right" }]}>{item.entregado}</Text>
                <Text style={[estilos.celda, { width: "15%", textAlign: "right" }]}>{Math.max(0, item.pedido - item.entregado)}</Text>
              </View>
            ))}
          </View>
        </View>

        {!!insumos.length && (
          <View style={estilos.seccion}>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Insumos utilizados</Text>
            <View style={estilos.tabla}>
              <View style={estilos.filaEncabezadoTabla}>
                <Text style={[estilos.celdaEncabezado, { width: "50%" }]}>Material</Text>
                <Text style={[estilos.celdaEncabezado, { width: "25%", textAlign: "right" }]}>Estimado</Text>
                <Text style={[estilos.celdaEncabezado, { width: "25%", textAlign: "right" }]}>Real</Text>
              </View>
              {insumos.map((insumo, i) => (
                <View key={i} style={estilos.filaTabla}>
                  <Text style={[estilos.celda, { width: "50%" }]}>{insumo.material}</Text>
                  <Text style={[estilos.celda, { width: "25%", textAlign: "right" }]}>
                    {insumo.cantidadEstimada ?? "—"} {insumo.unidad}
                  </Text>
                  <Text style={[estilos.celda, { width: "25%", textAlign: "right" }]}>
                    {insumo.cantidadReal ?? "—"} {insumo.unidad}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {notas && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>Notas</Text>
            <Text style={estilos.valor}>{notas}</Text>
          </View>
        )}

        {!!cronologia.length && (
          <View style={estilos.seccion}>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Cronología</Text>
            <View style={estilos.tabla}>
              <View style={estilos.filaEncabezadoTabla}>
                <Text style={[estilos.celdaEncabezado, { width: "30%" }]}>Fecha</Text>
                <Text style={[estilos.celdaEncabezado, { width: "70%" }]}>Evento</Text>
              </View>
              {cronologia.map((evento, i) => (
                <View key={i} style={estilos.filaTabla}>
                  <Text style={[estilos.celda, { width: "30%" }]}>
                    {evento.soloFecha ? formatearFechaSolo(evento.fecha) : formatearFechaHora(evento.fecha)}
                  </Text>
                  <Text style={[estilos.celda, { width: "70%" }]}>
                    {evento.titulo}
                    {evento.detalle ? ` — ${evento.detalle}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!!entregas.length && (
          <View style={estilos.seccion} break>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Entregas</Text>
            <View style={estilos.tabla}>
              <View style={estilos.filaEncabezadoTabla}>
                <Text style={[estilos.celdaEncabezado, { width: "18%" }]}>Fecha</Text>
                <Text style={[estilos.celdaEncabezado, { width: "22%" }]}>Entregó</Text>
                <Text style={[estilos.celdaEncabezado, { width: "22%" }]}>Recibió</Text>
                <Text style={[estilos.celdaEncabezado, { width: "38%" }]}>Piezas</Text>
              </View>
              {entregas.map((entrega, i) => (
                <View key={i} style={estilos.filaTabla}>
                  <Text style={[estilos.celda, { width: "18%" }]}>{formatearFechaSolo(entrega.fecha)}</Text>
                  <Text style={[estilos.celda, { width: "22%" }]}>{entrega.entrego}</Text>
                  <Text style={[estilos.celda, { width: "22%" }]}>{entrega.recibio}</Text>
                  <Text style={[estilos.celda, { width: "38%" }]}>
                    {entrega.piezas}
                    {entrega.cancelada ? " (cancelada)" : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pie />
      </Page>
    </Document>
  );
}
