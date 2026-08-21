import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";

export interface ItemEntregaPDF {
  producto: string;
  talla: string;
  cantidad: number;
}

export interface EntregaPDFProps {
  folio: string;
  cliente: string | null;
  fechaProgramada: string;
  fechaReal: string;
  recibidoPor: string;
  notas: string | null;
  items: ItemEntregaPDF[];
}

export function EntregaDocumento({
  folio,
  cliente,
  fechaProgramada,
  fechaReal,
  recibidoPor,
  notas,
  items,
}: EntregaPDFProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado titulo="Comprobante de entrega" folio={folio} />

        <View style={estilos.filaDatos}>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Cliente</Text>
            <Text style={estilos.valor}>{cliente ?? "—"}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha programada</Text>
            <Text style={estilos.valor}>{fechaProgramada}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha de entrega</Text>
            <Text style={estilos.valor}>{fechaReal}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Recibido por</Text>
            <Text style={estilos.valor}>{recibidoPor}</Text>
          </View>
        </View>

        {!!items.length && (
          <View style={estilos.seccion}>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Productos entregados</Text>
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
        )}

        {notas && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>Notas</Text>
            <Text style={estilos.valor}>{notas}</Text>
          </View>
        )}

        <View style={estilos.firmaContenedor}>
          <View style={estilos.firmaLinea} />
          <Text style={estilos.firmaEtiqueta}>Firma de quien recibe</Text>
          <Text style={estilos.firmaEtiqueta}>{recibidoPor}</Text>
        </View>

        <Pie />
      </Page>
    </Document>
  );
}
