import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Ticket de reclamo para la prenda que un cliente trae a bordar -- más
// grande que la etiqueta de rollo de materia prima (62x30mm) porque lleva
// bastante más texto: folio, descripción, cliente, fecha de entrega y la
// lista de bordados. 80x50mm da espacio cómodo para todo eso en una sola
// página, sin necesidad de una hoja tamaño carta para un ticket de mostrador.
const estilos = StyleSheet.create({
  pagina: {
    padding: 6,
    fontFamily: "Helvetica",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  qr: {
    width: 48,
    height: 48,
    marginRight: 6,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  folio: {
    fontSize: 12,
    fontWeight: 700,
  },
  descripcion: {
    fontSize: 8,
    fontWeight: 700,
    marginTop: 2,
  },
  linea: {
    fontSize: 7,
    color: "#333333",
    marginTop: 1,
  },
  separador: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    marginTop: 5,
    marginBottom: 4,
  },
  bordadosTitulo: {
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  bordadoItem: {
    fontSize: 7,
    color: "#333333",
    marginBottom: 1.5,
  },
});

const TIPO_LABEL: Record<string, string> = {
  logo: "Logo",
  nombre: "Nombre",
  texto_libre: "Texto",
};

export interface TicketPrendaBordadoPDF {
  folio: string;
  qrDataUrl: string;
  descripcion: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  fechaEntregaCompromiso: string;
  bordados: { ubicacion: string; tipo: string; descripcion: string }[];
}

// Con muchos bordados la lista se saldría del ticket -- se recortan los que
// no caben y se avisa cuántos quedaron fuera, en vez de desbordar la página.
const MAX_BORDADOS_VISIBLES = 6;

export function TicketPrendaBordado({ ticket }: { ticket: TicketPrendaBordadoPDF }) {
  const bordadosVisibles = ticket.bordados.slice(0, MAX_BORDADOS_VISIBLES);
  const restantes = ticket.bordados.length - bordadosVisibles.length;

  return (
    <Document>
      <Page size={{ width: "80mm", height: "50mm" }} style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <Image src={ticket.qrDataUrl} style={estilos.qr} />
          <View style={estilos.info}>
            <Text style={estilos.folio}>{ticket.folio}</Text>
            <Text style={estilos.descripcion}>{ticket.descripcion}</Text>
            <Text style={estilos.linea}>
              {ticket.clienteNombre}
              {ticket.clienteTelefono ? ` · ${ticket.clienteTelefono}` : ""}
            </Text>
            <Text style={estilos.linea}>Entrega: {ticket.fechaEntregaCompromiso}</Text>
          </View>
        </View>
        <View style={estilos.separador} />
        <Text style={estilos.bordadosTitulo}>Bordados</Text>
        {bordadosVisibles.map((b, i) => (
          <Text key={i} style={estilos.bordadoItem}>
            • {b.ubicacion} — {TIPO_LABEL[b.tipo] ?? b.tipo}: {b.descripcion}
          </Text>
        ))}
        {restantes > 0 && <Text style={estilos.bordadoItem}>+{restantes} más…</Text>}
      </Page>
    </Document>
  );
}
