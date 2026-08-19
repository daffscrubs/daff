import path from "node:path";
import { View, Text, Image } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import { estilos } from "@/lib/pdf/estilos";

const RUTA_LOGO = path.join(process.cwd(), "public/brand/logo-mark.png");

export function Encabezado({ titulo, folio }: { titulo: string; folio: string }) {
  return (
    <View style={estilos.encabezado}>
      <View style={estilos.empresaBloque}>
        <Image src={RUTA_LOGO} style={estilos.logo} />
        <View>
          <Text style={estilos.empresaNombre}>{EMPRESA.nombre}</Text>
          <Text style={estilos.empresaDato}>{EMPRESA.direccion}</Text>
          <Text style={estilos.empresaDato}>{EMPRESA.telefono} · {EMPRESA.correo}</Text>
        </View>
      </View>
      <View>
        <Text style={estilos.tituloDocumento}>{titulo}</Text>
        <Text style={estilos.folio}>{folio}</Text>
      </View>
    </View>
  );
}

export function Pie() {
  return (
    <Text style={estilos.pie} fixed>
      {EMPRESA.nombre} · {EMPRESA.correo} · {EMPRESA.telefono}
    </Text>
  );
}
