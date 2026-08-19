import { Document, Page, View, Text } from "@react-pdf/renderer";
import { Encabezado, Pie } from "@/lib/pdf/Encabezado";
import { estilos } from "@/lib/pdf/estilos";

export interface GastoPDFProps {
  folio: string;
  fecha: string;
  categoria: string;
  concepto: string;
  monto: number;
  notas: string | null;
  registradoPor: string;
}

export function GastoDocumento({ folio, fecha, categoria, concepto, monto, notas, registradoPor }: GastoPDFProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado titulo="Comprobante de gasto" folio={folio} />

        <View style={estilos.filaDatos}>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Fecha</Text>
            <Text style={estilos.valor}>{fecha}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Categoría</Text>
            <Text style={estilos.valor}>{categoria}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Concepto</Text>
            <Text style={estilos.valor}>{concepto}</Text>
          </View>
          <View style={estilos.columnaDato}>
            <Text style={estilos.etiqueta}>Registrado por</Text>
            <Text style={estilos.valor}>{registradoPor}</Text>
          </View>
        </View>

        <View style={estilos.totalFila}>
          <Text style={estilos.totalEtiqueta}>Monto</Text>
          <Text style={estilos.totalValor}>${monto.toFixed(2)}</Text>
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
