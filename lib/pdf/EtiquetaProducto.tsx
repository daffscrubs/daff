import path from "node:path";
import { Document, Page, View, Text, Image, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import { barrasCode128, modulosCode128 } from "@/lib/barcode/code128";

// Etiqueta física de producto: 62 x 25mm, una por página, para imprimir muchas de
// corrido en la impresora de etiquetas. Arriba a la izquierda va el nombre con la
// categoría y la talla, arriba a la derecha el logo; en medio el código de barras
// (Code 128) y abajo el código en texto, por si hay que teclearlo cuando el lector
// no lo alcanza a leer.
const RUTA_LOGO = path.join(process.cwd(), "public/brand/logo-full-trimmed.png");
const PROPORCION_LOGO = 762 / 1034; // ancho / alto del archivo
const ALTO_LOGO = 22;
const ANCHO_PT = 175.75; // 62mm
const MARGEN_X = 5;
const ALTO_CODIGO = 28;
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    height: ALTO_LOGO,
  },
  textos: {
    flex: 1,
    paddingTop: 2,
    paddingRight: 6,
  },
  nombre: {
    fontSize: 8,
    fontWeight: 700,
  },
  detalle: {
    fontSize: 6.5,
    color: "#444444",
    marginTop: 1.5,
  },
  logo: {
    height: ALTO_LOGO,
    width: ALTO_LOGO * PROPORCION_LOGO,
  },
  zonaCodigo: {
    alignItems: "center",
    marginTop: 2,
  },
  pie: {
    alignItems: "center",
    marginTop: 1.5,
    height: 8,
  },
  textoCodigo: {
    fontSize: 7,
    letterSpacing: 1,
  },
});

export interface EtiquetaProductoPDF {
  nombre: string;
  /** Categoría del producto, si tiene. */
  categoria: string | null;
  /** Talla; null cuando el producto no maneja tallas (no se imprime nada en su lugar). */
  talla: string | null;
  codigo: string;
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
      {etiquetas.map((etiqueta, i) => {
        const detalle = [etiqueta.categoria, etiqueta.talla].filter(Boolean).join(" / ");
        return (
          <Page key={i} size={{ width: "62mm", height: "25mm" }} style={estilos.pagina}>
            <View style={estilos.encabezado}>
              <View style={estilos.textos}>
                <Text style={estilos.nombre}>{etiqueta.nombre}</Text>
                {!!detalle && <Text style={estilos.detalle}>{detalle}</Text>}
              </View>
              <Image src={RUTA_LOGO} style={estilos.logo} />
            </View>
            <View style={estilos.zonaCodigo}>
              <CodigoDeBarras codigo={etiqueta.codigo} />
            </View>
            <View style={estilos.pie}>
              <Text style={estilos.textoCodigo}>{etiqueta.codigo}</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
