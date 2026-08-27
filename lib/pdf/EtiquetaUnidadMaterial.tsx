import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Etiqueta física para pegar en el rollo/bolsa: 62 x 30mm, para imprimir todas
// las que salieron de una misma compra en un solo PDF (una tras otra) y
// recortarlas. El código también va como texto (no solo QR) por si hay que
// leerlo a mano cuando el QR no escanea o la impresión sale borrosa.
const estilos = StyleSheet.create({
  pagina: {
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
    fontFamily: "Helvetica",
  },
  qr: {
    width: 66,
    height: 66,
    marginRight: 6,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  nombreMaterial: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 2,
  },
  linea: {
    fontSize: 7,
    color: "#333333",
    marginBottom: 1,
  },
  codigo: {
    fontSize: 6,
    color: "#666666",
    marginTop: 2,
  },
});

export interface EtiquetaUnidadPDF {
  codigo: string;
  qrDataUrl: string;
  nombreMaterial: string;
  numeroUnidad: number;
  cantidadInicial: number;
  unidadMedida: string;
}

export function EtiquetaUnidadMaterial({ etiquetas }: { etiquetas: EtiquetaUnidadPDF[] }) {
  return (
    <Document>
      {etiquetas.map((etiqueta, i) => (
        <Page key={i} size={{ width: "62mm", height: "30mm" }} style={estilos.pagina}>
          <Image src={etiqueta.qrDataUrl} style={estilos.qr} />
          <View style={estilos.info}>
            <Text style={estilos.nombreMaterial}>{etiqueta.nombreMaterial}</Text>
            <Text style={estilos.linea}>Unidad #{String(etiqueta.numeroUnidad).padStart(4, "0")}</Text>
            <Text style={estilos.linea}>
              {etiqueta.cantidadInicial} {etiqueta.unidadMedida}
            </Text>
            <Text style={estilos.codigo}>{etiqueta.codigo}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
