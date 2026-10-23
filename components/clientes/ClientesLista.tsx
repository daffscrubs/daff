"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass, Search, ShoppingBag, Users, Wallet } from "lucide-react";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearTelefono, inicialesCliente } from "@/lib/clientes";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta } from "@/lib/fechas";
import { normalizarTexto } from "@/lib/texto";
import { cn } from "@/lib/utils";

export interface ClienteLista {
  id: string;
  nombre: string;
  razonSocial: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  compras: number;
  total: number;
  ultimaCompra: string | null;
  saldo: number;
}

type Filtro = "todos" | "saldo" | "sin-compras";
type Orden = "nombre" | "total" | "compras" | "saldo" | "reciente";

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "nombre", etiqueta: "Nombre (A-Z)" },
  { valor: "total", etiqueta: "Más comprado" },
  { valor: "compras", etiqueta: "Más compras" },
  { valor: "saldo", etiqueta: "Mayor saldo" },
  { valor: "reciente", etiqueta: "Compra más reciente" },
];
const PAGINA = 100;

const porNombre = (a: ClienteLista, b: ClienteLista) => a.nombre.localeCompare(b.nombre, "es");
const COMPARADORES: Record<Orden, (a: ClienteLista, b: ClienteLista) => number> = {
  nombre: porNombre,
  total: (a, b) => b.total - a.total || porNombre(a, b),
  compras: (a, b) => b.compras - a.compras || porNombre(a, b),
  saldo: (a, b) => b.saldo - a.saldo || porNombre(a, b),
  reciente: (a, b) => (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? "") || porNombre(a, b),
};

function pasaFiltro(c: ClienteLista, filtro: Filtro): boolean {
  if (filtro === "saldo") return c.saldo > 0;
  if (filtro === "sin-compras") return c.compras === 0;
  return true;
}

// Busca en nombre, razón social, contacto, correo y teléfono (también por los dígitos, sin importar espacios o el +52).
function coincide(c: ClienteLista, q: string): boolean {
  if (!q) return true;
  if (normalizarTexto(`${c.nombre} ${c.razonSocial ?? ""} ${c.contacto ?? ""} ${c.telefono ?? ""} ${c.email ?? ""}`).includes(q)) return true;
  const digitos = q.replace(/\D/g, "");
  return digitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(digitos);
}

function Resumen({ icono: Icono, titulo, valor, tono }: { icono: typeof Users; titulo: string; valor: string; tono?: "ambar" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icono className="size-4" />
        {titulo}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tono === "ambar" && "text-amber-600")}>{valor}</p>
    </div>
  );
}

export function ClientesLista({ clientes }: { clientes: ClienteLista[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("nombre");
  const [visibles, setVisibles] = useState(PAGINA);

  const conSaldo = clientes.filter((c) => c.saldo > 0);
  const resumen = {
    total: clientes.length,
    conCompras: clientes.filter((c) => c.compras > 0).length,
    conSaldo: conSaldo.length,
    saldo: conSaldo.reduce((acc, c) => acc + c.saldo, 0),
  };

  const q = normalizarTexto(busqueda.trim());
  const filtrados = clientes.filter((c) => pasaFiltro(c, filtro) && coincide(c, q)).sort(COMPARADORES[orden]);

  const FILTROS: { valor: Filtro; etiqueta: string; cantidad: number }[] = [
    { valor: "todos", etiqueta: "Todos", cantidad: clientes.length },
    { valor: "saldo", etiqueta: "Con saldo pendiente", cantidad: resumen.conSaldo },
    { valor: "sin-compras", etiqueta: "Sin compras", cantidad: clientes.length - resumen.conCompras },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumen icono={Users} titulo="Clientes" valor={resumen.total.toLocaleString("es-MX")} />
        <Resumen icono={ShoppingBag} titulo="Con compras" valor={resumen.conCompras.toLocaleString("es-MX")} />
        <Resumen icono={Hourglass} titulo="Con saldo pendiente" valor={resumen.conSaldo.toLocaleString("es-MX")} tono={resumen.conSaldo ? "ambar" : undefined} />
        <Resumen icono={Wallet} titulo="Por cobrar" valor={formatearMoneda(resumen.saldo)} tono={resumen.saldo ? "ambar" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, correo o razón social"
            aria-label="Buscar clientes"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibles(PAGINA);
            }}
            className="h-10 bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => {
                setFiltro(f.valor);
                setVisibles(PAGINA);
              }}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", filtro === f.valor ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
            >
              {f.etiqueta} <span className={cn("ml-1 tabular-nums", filtro === f.valor ? "opacity-80" : "text-muted-foreground")}>{f.cantidad}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Select items={ORDENES.map((o) => ({ value: o.valor, label: o.etiqueta }))} value={orden} onValueChange={(v) => v && setOrden(v as Orden)}>
            <SelectTrigger className="h-10 w-48 bg-background" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDENES.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Total comprado</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead className="pr-4 text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.slice(0, visibles).map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/clientes/${c.id}`)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{inicialesCliente(c.nombre)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.nombre}</p>
                      {(c.razonSocial || c.contacto) && <p className="truncate text-xs text-muted-foreground">{c.razonSocial || c.contacto}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatearTelefono(c.telefono) || "—"}</TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{c.compras ? c.compras.toLocaleString("es-MX") : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{c.total ? formatearMoneda(c.total) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{c.ultimaCompra ? formatearFechaCorta(c.ultimaCompra) : "—"}</TableCell>
                <TableCell className={cn("pr-4 text-right tabular-nums", c.saldo > 0 ? "font-semibold text-amber-600" : "text-muted-foreground")}>{c.saldo > 0 ? formatearMoneda(c.saldo) : "—"}</TableCell>
              </TableRow>
            ))}
            {!filtrados.length && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EstadoVacio
                    icon={Users}
                    titulo={clientes.length ? "Sin resultados" : "Sin clientes todavía"}
                    descripcion={clientes.length ? "Prueba con otra búsqueda o cambia el filtro." : "Los clientes que agregues van a aparecer aquí."}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filtrados.length > visibles && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {visibles} de {filtrados.length.toLocaleString("es-MX")}
          </p>
          <button type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" onClick={() => setVisibles((v) => v + PAGINA)}>
            Mostrar más
          </button>
        </div>
      )}
    </div>
  );
}
