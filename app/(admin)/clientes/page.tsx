import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NuevoClienteDialog } from "@/components/clientes/NuevoClienteDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre_comercial");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground">Datos comerciales y contacto de tus clientes.</p>
        </div>
        <NuevoClienteDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre comercial</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Correo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes?.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell>
                <Link href={`/clientes/${cliente.id}`} className="font-medium hover:underline">
                  {cliente.nombre_comercial}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{cliente.contacto_nombre ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{cliente.telefono ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{cliente.email ?? "—"}</TableCell>
            </TableRow>
          ))}
          {!clientes?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin clientes todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
