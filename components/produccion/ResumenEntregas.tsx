import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { totalesResumen, type ResumenItem } from "@/lib/produccion/entregas";
import { cn } from "@/lib/utils";

// Por producto y talla: lo pedido, lo entregado y lo que falta.
export function ResumenEntregas({ resumen }: { resumen: ResumenItem[] }) {
  const total = totalesResumen(resumen);
  const avance = total.pedido ? Math.round((total.entregado / total.pedido) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${avance}%` }} />
        </div>
        <span className="w-40 text-right text-sm tabular-nums text-muted-foreground">
          {total.entregado} de {total.pedido} piezas · {avance}%
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Producto</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead className="text-right">Pedido</TableHead>
              <TableHead className="text-right">Entregado</TableHead>
              <TableHead className="pr-4 text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumen.map((r) => (
              <TableRow key={r.itemId}>
                <TableCell className="pl-4 font-medium">{r.modelo}</TableCell>
                <TableCell>{r.talla}</TableCell>
                <TableCell className="text-right tabular-nums">{r.pedido}</TableCell>
                <TableCell className="text-right tabular-nums">{r.entregado}</TableCell>
                <TableCell className={cn("pr-4 text-right tabular-nums", r.pendiente > 0 ? "font-semibold text-amber-600" : "text-emerald-600")}>
                  {r.pendiente > 0 ? r.pendiente : "Completo"}
                </TableCell>
              </TableRow>
            ))}
            {!resumen.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Esta orden no tiene productos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {resumen.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell className="pl-4" colSpan={2}>
                  Total
                </TableCell>
                <TableCell className="text-right tabular-nums">{total.pedido}</TableCell>
                <TableCell className="text-right tabular-nums">{total.entregado}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{total.pendiente}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
