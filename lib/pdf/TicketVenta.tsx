import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import { formatearMoneda } from "@/lib/dinero";

// Ticket de venta para impresora térmica de 80mm. El PDF no se ajusta solo al contenido, así que el
// alto de la página se calcula según cuántas partidas y pagos lleva (ver altoTicketMm).
const RUTA_LOGO = path.join(process.cwd(), "public/brand/logo-mark.png");

const estilos = StyleSheet.create({
  pagina: { padding: 10, fontFamily: "Helvetica", fontSize: 8, color: "#000000" },
  centrado: { alignItems: "center", textAlign: "center" },
  logo: { width: 30, height: 28.5, marginBottom: 3 },
  empresa: { fontSize: 10, fontWeight: 700 },
  dato: { fontSize: 7, color: "#333333" },
  separador: { borderBottomWidth: 0.5, borderBottomColor: "#000000", borderStyle: "dashed", marginVertical: 5 },
  fila: { flexDirection: "row", justifyContent: "space-between" },
  folio: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  partida: { marginBottom: 3 },
  partidaDetalle: { fontSize: 7, color: "#333333" },
  negrita: { fontWeight: 700 },
  total: { fontSize: 11, fontWeight: 700 },
  cancelada: { fontSize: 12, fontWeight: 700, textAlign: "center", marginVertical: 4 },
  gracias: { fontSize: 8, textAlign: "center", marginTop: 6 },
});

export interface TicketVentaPDF {
  folio: string;
  fecha: string;
  ubicacion: string;
  vendedor: string;
  cliente: string | null;
  cancelada: boolean;
  motivoCancelacion: string | null;
  partidas: { descripcion: string; cantidad: number; precioUnitario: number; importe: number }[];
  subtotal: number;
  descuento: number;
  total: number;
  pagos: { metodo: string; monto: number; recibido: number | null }[];
}

const METODO = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" } as Record<string, string>;

export function altoTicketMm(partidas: number, pagos: number, extras = 0): number {
  return Math.ceil(54 + partidas * 11 + pagos * 5 + extras * 5);
}

export function TicketVenta({ ticket }: { ticket: TicketVentaPDF }) {
  const cambio = ticket.pagos.reduce((acc, p) => acc + (p.metodo === "efectivo" && p.recibido ? p.recibido - p.monto : 0), 0);
  const alto = altoTicketMm(ticket.partidas.length, ticket.pagos.length, (ticket.descuento > 0 ? 1 : 0) + (ticket.cancelada ? 2 : 0) + (cambio > 0 ? 2 : 0));
  return (
    <Document>
      <Page size={{ width: "80mm", height: `${alto}mm` }} style={estilos.pagina}>
        <View style={estilos.centrado}>
          <Image src={RUTA_LOGO} style={estilos.logo} />
          <Text style={estilos.empresa}>{EMPRESA.nombre}</Text>
          <Text style={estilos.dato}>{EMPRESA.direccion}</Text>
          <Text style={estilos.dato}>{EMPRESA.telefono}</Text>
          <Text style={estilos.folio}>{ticket.folio}</Text>
          <Text style={estilos.dato}>{ticket.fecha}</Text>
        </View>
        <View style={estilos.separador} />
        <Text style={estilos.dato}>Sucursal: {ticket.ubicacion}</Text>
        <Text style={estilos.dato}>Atendió: {ticket.vendedor}</Text>
        {ticket.cliente && <Text style={estilos.dato}>Cliente: {ticket.cliente}</Text>}
        {ticket.cancelada && (
          <>
            <View style={estilos.separador} />
            <Text style={estilos.cancelada}>VENTA CANCELADA</Text>
            {ticket.motivoCancelacion && <Text style={[estilos.dato, { textAlign: "center" }]}>{ticket.motivoCancelacion}</Text>}
          </>
        )}
        <View style={estilos.separador} />

        {ticket.partidas.map((p, i) => (
          <View key={i} style={estilos.partida} wrap={false}>
            <Text>{p.descripcion}</Text>
            <View style={estilos.fila}>
              <Text style={estilos.partidaDetalle}>
                {p.cantidad} x {formatearMoneda(p.precioUnitario)}
              </Text>
              <Text style={estilos.negrita}>{formatearMoneda(p.importe)}</Text>
            </View>
          </View>
        ))}

        <View style={estilos.separador} />
        <View style={estilos.fila}>
          <Text>Subtotal</Text>
          <Text>{formatearMoneda(ticket.subtotal)}</Text>
        </View>
        {ticket.descuento > 0 && (
          <View style={estilos.fila}>
            <Text>Descuento</Text>
            <Text>-{formatearMoneda(ticket.descuento)}</Text>
          </View>
        )}
        <View style={[estilos.fila, { marginTop: 2 }]}>
          <Text style={estilos.total}>TOTAL</Text>
          <Text style={estilos.total}>{formatearMoneda(ticket.total)}</Text>
        </View>

        <View style={estilos.separador} />
        {ticket.pagos.map((p, i) => (
          <View key={i} style={estilos.fila}>
            <Text>{METODO[p.metodo] ?? p.metodo}</Text>
            <Text>{formatearMoneda(p.monto)}</Text>
          </View>
        ))}
        {cambio > 0 && (
          <>
            <View style={estilos.fila}>
              <Text style={estilos.dato}>Efectivo recibido</Text>
              <Text style={estilos.dato}>{formatearMoneda(ticket.pagos.find((p) => p.metodo === "efectivo")?.recibido ?? 0)}</Text>
            </View>
            <View style={estilos.fila}>
              <Text style={estilos.negrita}>Cambio</Text>
              <Text style={estilos.negrita}>{formatearMoneda(cambio)}</Text>
            </View>
          </>
        )}
        <Text style={estilos.gracias}>¡Gracias por su compra!</Text>
      </Page>
    </Document>
  );
}
