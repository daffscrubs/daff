import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";
import { formatearMoneda } from "@/lib/dinero";

export interface ItemPedidoPDF {
  producto: string;
  talla: string;
  cantidad: number;
  precioUnitario: number | null;
}

export interface PedidoPDFProps {
  folio: string;
  cliente: string;
  contacto: string;
  telefono: string;
  fechaPedido: string;
  fechaCompromiso: string;
  estatus: string;
  notas: string | null;
  items: ItemPedidoPDF[];
}

export function PedidoDocumento({ folio, cliente, contacto, telefono, fechaPedido, fechaCompromiso, estatus, notas, items }: PedidoPDFProps) {
  const total = items.reduce((acc, i) => acc + i.cantidad * (i.precioUnitario ?? 0), 0);
  const hayPrecios = items.some((i) => i.precioUnitario);

  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado titulo="Pedido" folio={folio} />

        <View style={estilos.filaDatos}>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Cliente</Text>
            <Text style={estilos.valor}>{cliente}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Estatus</Text>
            <Text style={estilos.valor}>{estatus}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Contacto</Text>
            <Text style={estilos.valor}>{contacto || "—"}{telefono ? ` · ${telefono}` : ""}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha de pedido</Text>
            <Text style={estilos.valor}>{fechaPedido}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha compromiso</Text>
            <Text style={estilos.valor}>{fechaCompromiso}</Text>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaEncabezadoTabla}>
            <Text style={[estilos.celdaEncabezado, { width: "46%" }]}>Producto</Text>
            <Text style={[estilos.celdaEncabezado, { width: "18%" }]}>Talla</Text>
            <Text style={[estilos.celdaEncabezado, { width: "14%", textAlign: "right" }]}>Cant.</Text>
            {hayPrecios && (
              <Text style={[estilos.celdaEncabezado, { width: "22%", textAlign: "right" }]}>P. unit.</Text>
            )}
          </View>
          {items.map((item, i) => (
            <View key={i} style={estilos.filaTabla}>
              <Text style={[estilos.celda, { width: "46%" }]}>{item.producto}</Text>
              <Text style={[estilos.celda, { width: "18%" }]}>{item.talla}</Text>
              <Text style={[estilos.celda, { width: "14%", textAlign: "right" }]}>{item.cantidad}</Text>
              {hayPrecios && (
                <Text style={[estilos.celda, { width: "22%", textAlign: "right" }]}>
                  {item.precioUnitario != null ? formatearMoneda(item.precioUnitario) : "—"}
                </Text>
              )}
            </View>
          ))}
        </View>

        {hayPrecios && (
          <View style={estilos.totalFila}>
            <Text style={estilos.totalEtiqueta}>Total</Text>
            <Text style={estilos.totalValor}>{formatearMoneda(total)}</Text>
          </View>
        )}

        {notas && (
          <View style={[estilos.seccion, { marginTop: 20 }]}>
            <Text style={estilos.etiqueta}>Notas</Text>
            <Text style={estilos.valor}>{notas}</Text>
          </View>
        )}

        <Pie />
      </Page>
    </Document>
  );
}
