import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";
import { formatearFechaHora, formatearFechaSolo } from "@/lib/fechas";

export interface ItemOrdenPDF {
  producto: string;
  talla: string;
  cantidad: number;
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

export interface RegistroAvancePDF {
  fecha: string;
  colaborador: string;
  proceso: string;
  producto: string;
  cantidad: number;
}

export interface OrdenProduccionPDFProps {
  folio: string;
  cliente: string | null;
  estatus: string;
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
  notas: string | null;
  items: ItemOrdenPDF[];
  procesos: string[];
  insumos: InsumoOrdenPDF[];
  cronologia: EventoHistorialPDF[];
  registrosAvance: RegistroAvancePDF[];
}

export function OrdenProduccionDocumento({
  folio,
  cliente,
  estatus,
  fechaInicio,
  fechaFinEstimada,
  notas,
  items,
  procesos,
  insumos,
  cronologia,
  registrosAvance,
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
            <Text style={estilos.etiqueta}>Proceso</Text>
            <Text style={estilos.valor}>{procesos.length ? procesos.join(" → ") : "Sin definir"}</Text>
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Productos a fabricar</Text>
          <View style={estilos.tabla}>
            <View style={estilos.filaEncabezadoTabla}>
              <Text style={[estilos.celdaEncabezado, { width: "60%" }]}>Producto</Text>
              <Text style={[estilos.celdaEncabezado, { width: "20%" }]}>Talla</Text>
              <Text style={[estilos.celdaEncabezado, { width: "20%", textAlign: "right" }]}>Cantidad</Text>
            </View>
            {items.map((item, i) => (
              <View key={i} style={estilos.filaTabla}>
                <Text style={[estilos.celda, { width: "60%" }]}>{item.producto}</Text>
                <Text style={[estilos.celda, { width: "20%" }]}>{item.talla}</Text>
                <Text style={[estilos.celda, { width: "20%", textAlign: "right" }]}>{item.cantidad}</Text>
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

        {!!registrosAvance.length && (
          <View style={estilos.seccion} break>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Registros de avance por colaborador</Text>
            <View style={estilos.tabla}>
              <View style={estilos.filaEncabezadoTabla}>
                <Text style={[estilos.celdaEncabezado, { width: "20%" }]}>Fecha</Text>
                <Text style={[estilos.celdaEncabezado, { width: "25%" }]}>Colaborador</Text>
                <Text style={[estilos.celdaEncabezado, { width: "20%" }]}>Proceso</Text>
                <Text style={[estilos.celdaEncabezado, { width: "25%" }]}>Producto</Text>
                <Text style={[estilos.celdaEncabezado, { width: "10%", textAlign: "right" }]}>Cant.</Text>
              </View>
              {registrosAvance.map((registro, i) => (
                <View key={i} style={estilos.filaTabla}>
                  <Text style={[estilos.celda, { width: "20%" }]}>
                    {formatearFechaHora(registro.fecha)}
                  </Text>
                  <Text style={[estilos.celda, { width: "25%" }]}>{registro.colaborador}</Text>
                  <Text style={[estilos.celda, { width: "20%" }]}>{registro.proceso}</Text>
                  <Text style={[estilos.celda, { width: "25%" }]}>{registro.producto}</Text>
                  <Text style={[estilos.celda, { width: "10%", textAlign: "right" }]}>{registro.cantidad}</Text>
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
