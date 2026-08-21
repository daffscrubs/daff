import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";
import { formatearMoneda } from "@/lib/dinero";

export interface ItemCompraPDF {
  material: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
  subtotal: number;
}

export interface CompraPDFProps {
  folio: string;
  proveedor: string;
  fecha: string;
  notas: string | null;
  items: ItemCompraPDF[];
  total: number;
}

export function CompraDocumento({ folio, proveedor, fecha, notas, items, total }: CompraPDFProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado titulo="Compra" folio={folio} />

        <View style={estilos.filaDatos}>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Proveedor</Text>
            <Text style={estilos.valor}>{proveedor}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha</Text>
            <Text style={estilos.valor}>{fecha}</Text>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaEncabezadoTabla}>
            <Text style={[estilos.celdaEncabezado, { width: "40%" }]}>Material</Text>
            <Text style={[estilos.celdaEncabezado, { width: "20%", textAlign: "right" }]}>Cantidad</Text>
            <Text style={[estilos.celdaEncabezado, { width: "20%", textAlign: "right" }]}>Costo unit.</Text>
            <Text style={[estilos.celdaEncabezado, { width: "20%", textAlign: "right" }]}>Subtotal</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={estilos.filaTabla}>
              <Text style={[estilos.celda, { width: "40%" }]}>{item.material}</Text>
              <Text style={[estilos.celda, { width: "20%", textAlign: "right" }]}>{item.cantidad} {item.unidad}</Text>
              <Text style={[estilos.celda, { width: "20%", textAlign: "right" }]}>{formatearMoneda(item.costoUnitario)}</Text>
              <Text style={[estilos.celda, { width: "20%", textAlign: "right" }]}>{formatearMoneda(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.totalFila}>
          <Text style={estilos.totalEtiqueta}>Total</Text>
          <Text style={estilos.totalValor}>{formatearMoneda(total)}</Text>
        </View>

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
