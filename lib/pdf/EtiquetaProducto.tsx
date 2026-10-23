import { Document, Page, View, Text, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import { barrasCode128, modulosCode128 } from "@/lib/barcode/code128";

// Etiqueta física de producto: 62 x 25mm, una por página, para imprimir muchas de
// corrido en la impresora de etiquetas. Lleva el nombre y la talla arriba, el código de
// barras (Code 128) al centro y el código en texto con el precio abajo. El código va
// también en texto por si hay que teclearlo cuando el lector no lo alcanza a leer.
const ANCHO_PT = 175.75; // 62mm
const MARGEN_X = 5;
const ALTO_CODIGO = 34;
const ZONA_SILENCIO = 10; // módulos en blanco a cada lado: sin ellos el lector no ubica el inicio
const MODULO_MAXIMO = 1.3; // pt; por encima de esto el código se ve desproporcionado
const ANCHO_UTIL = ANCHO_PT - MARGEN_X * 2;

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: MARGEN_X,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 11,
  },
  nombre: {
    fontSize: 7.5,
    fontWeight: 700,
    flex: 1,
  },
  talla: {
    fontSize: 9,
    fontWeight: 700,
    marginLeft: 4,
  },
  zonaCodigo: {
    alignItems: "center",
    marginTop: 2,
  },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1.5,
    height: 8,
  },
  relleno: { flex: 1 },
  textoCodigo: {
    fontSize: 7,
    letterSpacing: 1,
  },
  precio: {
    flex: 1,
    fontSize: 7,
    fontWeight: 700,
    textAlign: "right",
  },
});

export interface EtiquetaProductoPDF {
  nombre: string;
  talla: string;
  codigo: string;
  precio: string | null;
}

function CodigoDeBarras({ codigo }: { codigo: string }) {
  const totalModulos = modulosCode128(codigo).length + ZONA_SILENCIO * 2;
  const modulo = Math.min(MODULO_MAXIMO, ANCHO_UTIL / totalModulos);
  const ancho = totalModulos * modulo;
  return (
    <Svg width={ancho} height={ALTO_CODIGO} viewBox={`0 0 ${ancho} ${ALTO_CODIGO}`}>
      {barrasCode128(codigo).map((b, i) => (
        <Rect key={i} x={(b.inicio + ZONA_SILENCIO) * modulo} y={0} width={b.ancho * modulo} height={ALTO_CODIGO} fill="#000000" />
      ))}
    </Svg>
  );
}

export function EtiquetaProducto({ etiquetas }: { etiquetas: EtiquetaProductoPDF[] }) {
  return (
    <Document>
      {etiquetas.map((etiqueta, i) => (
        <Page key={i} size={{ width: "62mm", height: "25mm" }} style={estilos.pagina}>
          <View style={estilos.encabezado}>
            <Text style={estilos.nombre}>{etiqueta.nombre}</Text>
            <Text style={estilos.talla}>{etiqueta.talla}</Text>
          </View>
          <View style={estilos.zonaCodigo}>
            <CodigoDeBarras codigo={etiqueta.codigo} />
          </View>
          <View style={estilos.pie}>
            <View style={estilos.relleno} />
            <Text style={estilos.textoCodigo}>{etiqueta.codigo}</Text>
            <Text style={estilos.precio}>{etiqueta.precio ?? ""}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
