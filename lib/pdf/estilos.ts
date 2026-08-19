import { StyleSheet } from "@react-pdf/renderer";

export const estilos = StyleSheet.create({
  pagina: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  logo: {
    width: 32,
    height: 32,
  },
  empresaBloque: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  empresaNombre: {
    fontSize: 14,
    fontWeight: 700,
  },
  empresaDato: {
    fontSize: 8.5,
    color: "#555555",
  },
  tituloDocumento: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "right",
  },
  folio: {
    fontSize: 9,
    color: "#555555",
    textAlign: "right",
    marginTop: 2,
  },
  seccion: {
    marginBottom: 16,
  },
  filaDatos: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  columnaDato: {
    width: "50%",
    marginBottom: 8,
  },
  etiqueta: {
    fontSize: 8,
    color: "#777777",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  valor: {
    fontSize: 10,
  },
  tabla: {
    marginTop: 8,
  },
  filaTabla: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingVertical: 6,
  },
  filaEncabezadoTabla: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 6,
    marginBottom: 2,
  },
  celdaEncabezado: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#555555",
  },
  celda: {
    fontSize: 9.5,
  },
  totalFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#111111",
  },
  totalEtiqueta: {
    fontSize: 11,
    fontWeight: 700,
    marginRight: 12,
  },
  totalValor: {
    fontSize: 11,
    fontWeight: 700,
  },
  pie: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
  },
});
