// Importa clientes y ventas históricas exportados del sistema anterior (Pulpos).
//
//   node --env-file=.env.local scripts/importar-pulpos.mjs --clientes <Clientes.xlsx> --ventas <Ventas1.xlsx> [--ventas <Ventas2.xlsx>]
//   (agrega --aplicar para escribir en la base; sin él solo muestra qué haría)
//
// Es seguro volver a correrlo: los clientes se buscan por nombre (no se duplican) y las ventas se guardan
// por número de venta (una venta ya importada se actualiza, no se repite). Requiere la migración 0033.
import ExcelJS from "exceljs";
import { pathToFileURL } from "node:url";

const celda = (v) => {
  if (v && typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString();
    return v.text ?? v.result ?? "";
  }
  return v ?? "";
};
const texto = (v) => String(celda(v)).trim();
const numero = (v) => {
  const n = Number(celda(v));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
export const normalizar = (s) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

async function filas(archivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);
  const ws = wb.worksheets[0];
  const cabecera = ws.getRow(1).values.slice(1).map(texto);
  const salida = [];
  ws.eachRow((fila, i) => {
    if (i === 1) return;
    const v = fila.values.slice(1);
    salida.push(Object.fromEntries(cabecera.map((h, j) => [h, v[j]])));
  });
  return salida;
}

// +52 55 1234 5678 -> se conserva tal cual venía; si no tiene al menos 10 dígitos no es un teléfono usable.
function telefonoLimpio(valor) {
  const t = texto(valor).replace(/[^\d+]/g, "");
  return t.replace(/\D/g, "").length >= 10 ? t : null;
}

export async function leerClientes(archivo) {
  const porNombre = new Map();
  for (const f of await filas(archivo)) {
    const nombre = [texto(f["Nombre"]), texto(f["Apellido"])].filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (!nombre) continue;
    const c = { nombre, telefono: telefonoLimpio(f["Teléfono"]), email: texto(f["Email"]) || null };
    const clave = normalizar(nombre);
    const previo = porNombre.get(clave);
    // El mismo cliente dos veces: se queda con uno y se completan los datos que le falten.
    porNombre.set(clave, previo ? { ...previo, telefono: previo.telefono ?? c.telefono, email: previo.email ?? c.email, repetido: true } : c);
  }
  return [...porNombre.values()];
}

const ESTATUS = { pagada: "pagada", "deuda pendiente": "deuda_pendiente", impaga: "impaga", reembolsada: "reembolsada", cancelada: "cancelada" };

// "23/10/2026 13:34:06" está en hora de México (UTC-6): se guarda en UTC.
function fechaUtc(s) {
  const m = texto(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 6, +m[5], +m[6])).toISOString();
}

export async function leerVentas(archivos) {
  const porNumero = new Map();
  const avisos = [];
  for (const archivo of archivos) {
    for (const f of await filas(archivo)) {
      const num = Number(texto(f["Número de venta"]).replace("#", ""));
      const fecha = fechaUtc(f["Fecha"]);
      const estatus = ESTATUS[normalizar(f["Estado"])];
      if (!Number.isInteger(num) || num <= 0 || !fecha || !estatus) {
        avisos.push(`Fila omitida (${texto(f["Número de venta"])}): número, fecha o estado inválidos`);
        continue;
      }
      const venc = texto(f["Vencimiento de Deuda"]);
      const venta = {
        numero: num,
        fecha,
        cliente_nombre: texto(f["Cliente"]) || null,
        cajero: texto(f["Cajero"]) || null,
        vendedor: texto(f["Vendedor"]) || null,
        caja: texto(f["Caja"]) || null,
        estatus,
        entrega: texto(f["Productos"]) || null,
        subtotal: numero(f["Subtotal"]),
        descuento: numero(f["Descuento"]),
        total: numero(f["Total"]),
        reembolsos: numero(f["Reembolsos"]),
        total_actualizado: numero(f["Total Actualizado"]),
        pago_efectivo: numero(f["Pago en Efectivo"]),
        pago_tarjeta: numero(f["Pago con Tarjeta de Débito"]),
        pago_transferencia: numero(f["Pago por Transferencia"]),
        deuda_inicial: numero(f["Deuda Inicial"]),
        deuda_actual: numero(f["Deuda Actual"]),
        vencimiento_deuda: /^\d{4}-\d{2}-\d{2}/.test(venc) ? venc.slice(0, 10) : null,
        facturada: normalizar(f["Facturada"]) === "si",
        nota: texto(f["Nota"]) || null,
      };
      const previa = porNumero.get(num);
      if (previa && JSON.stringify(previa) !== JSON.stringify(venta)) avisos.push(`La venta #${num} aparece dos veces con datos distintos: se usa la última`);
      porNumero.set(num, venta);
    }
  }
  return { ventas: [...porNumero.values()].sort((a, b) => a.numero - b.numero), avisos };
}

// Enlaza cada venta con su cliente por nombre. "Público en General" no es un cliente.
export function enlazarClientes(ventas, clientesPorNombre) {
  let enlazadas = 0;
  const sinEnlazar = new Map();
  const salida = ventas.map((v) => {
    const nombre = v.cliente_nombre;
    if (!nombre || normalizar(nombre) === "publico en general") return { ...v, cliente_id: null, cliente_nombre: null };
    const id = clientesPorNombre.get(normalizar(nombre)) ?? null;
    if (id) enlazadas++;
    else sinEnlazar.set(nombre, (sinEnlazar.get(nombre) ?? 0) + 1);
    return { ...v, cliente_id: id };
  });
  return { ventas: salida, enlazadas, sinEnlazar };
}

const dinero = (n) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

async function principal() {
  const args = process.argv.slice(2);
  const valores = (bandera) => args.flatMap((a, i) => (a === bandera ? [args[i + 1]] : []));
  const archivoClientes = valores("--clientes")[0];
  const archivosVentas = valores("--ventas");
  const aplicar = args.includes("--aplicar");
  if (!archivoClientes && !archivosVentas.length) {
    console.error("Uso: node --env-file=.env.local scripts/importar-pulpos.mjs --clientes <xlsx> --ventas <xlsx> [--ventas <xlsx>] [--aplicar]");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(aplicar ? "MODO: se va a escribir en la base." : "MODO: prueba (no se escribe nada). Agrega --aplicar para importar.");

  // --- Clientes ---
  const { data: existentes, error: errExist } = await supabase.from("clientes").select("id, nombre_comercial, telefono, email");
  if (errExist) throw errExist;
  const porNombre = new Map(existentes.map((c) => [normalizar(c.nombre_comercial), c]));
  const pendientes = new Set(); // clientes nuevos que en modo prueba aún no existen en la base
  if (archivoClientes) {
    const clientes = await leerClientes(archivoClientes);
    const nuevos = clientes.filter((c) => !porNombre.has(normalizar(c.nombre)));
    if (!aplicar) for (const c of nuevos) pendientes.add(normalizar(c.nombre));
    const completar = clientes.filter((c) => porNombre.has(normalizar(c.nombre)) && ((c.telefono && !porNombre.get(normalizar(c.nombre)).telefono) || (c.email && !porNombre.get(normalizar(c.nombre)).email)));
    console.log(`Clientes en el archivo: ${clientes.length} (${clientes.filter((c) => c.repetido).length} venía repetido y se unió) | ya existían: ${clientes.length - nuevos.length} | nuevos: ${nuevos.length} | a completar con teléfono/correo: ${completar.length}`);
    if (aplicar) {
      for (let i = 0; i < nuevos.length; i += 200) {
        const lote = nuevos.slice(i, i + 200).map((c) => ({ nombre_comercial: c.nombre, telefono: c.telefono, email: c.email }));
        const { error } = await supabase.from("clientes").insert(lote);
        if (error) throw error;
      }
      for (const c of completar) {
        const actual = porNombre.get(normalizar(c.nombre));
        const { error } = await supabase.from("clientes").update({ telefono: actual.telefono ?? c.telefono, email: actual.email ?? c.email }).eq("id", actual.id);
        if (error) throw error;
      }
      console.log("Clientes escritos.");
    }
  }

  // --- Ventas ---
  if (archivosVentas.length) {
    const { ventas, avisos } = await leerVentas(archivosVentas);
    for (const a of avisos) console.warn("AVISO:", a);
    // Los clientes pueden ser recién creados: se vuelven a leer para tener los ids.
    const { data: clientesAhora, error } = await supabase.from("clientes").select("id, nombre_comercial");
    if (error) throw error;
    const mapa = new Map(clientesAhora.map((c) => [normalizar(c.nombre_comercial), c.id]));
    for (const nombre of pendientes) mapa.set(nombre, "(se creará)");
    const enlazado = enlazarClientes(ventas, mapa);
    const activas = ventas.filter((v) => v.estatus !== "cancelada");
    const suma = (k, lista = activas) => lista.reduce((a, v) => a + v[k], 0);
    console.log(`Ventas: ${ventas.length} (${ventas.length - activas.length} cancelada) | del ${ventas[0].fecha.slice(0, 10)} al ${ventas.at(-1).fecha.slice(0, 10)}`);
    console.log(`  Venta neta ${dinero(suma("total_actualizado"))} | reembolsos ${dinero(suma("reembolsos"))} | descuentos ${dinero(suma("descuento"))}`);
    console.log(`  Efectivo ${dinero(suma("pago_efectivo"))} | tarjeta ${dinero(suma("pago_tarjeta"))} | transferencia ${dinero(suma("pago_transferencia"))}`);
    console.log(`  Con cliente enlazado: ${enlazado.enlazadas} | nombres sin cliente en la lista: ${[...enlazado.sinEnlazar].map(([n, c]) => `${n} (${c})`).join(", ") || "ninguno"}`);
    if (aplicar) {
      for (let i = 0; i < enlazado.ventas.length; i += 500) {
        const { error: errVentas } = await supabase.from("ventas_historicas").upsert(enlazado.ventas.slice(i, i + 500), { onConflict: "numero" });
        if (errVentas) throw errVentas;
      }
      // Verificación: lo que quedó en la base debe coincidir con el archivo.
      let guardadas = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error: errLeer } = await supabase.from("ventas_historicas").select("numero, total_actualizado, estatus").order("numero").range(desde, desde + 999);
        if (errLeer) throw errLeer;
        guardadas = guardadas.concat(data);
        if (data.length < 1000) break;
      }
      const esperado = new Map(ventas.map((v) => [v.numero, v]));
      const dentro = guardadas.filter((g) => esperado.has(g.numero));
      const sumaBase = dentro.filter((g) => g.estatus !== "cancelada").reduce((a, g) => a + Number(g.total_actualizado), 0);
      console.log(`Verificación: ${dentro.length}/${ventas.length} ventas en la base; venta neta ${dinero(sumaBase)} (archivo: ${dinero(suma("total_actualizado"))}) -> ${dentro.length === ventas.length && Math.abs(sumaBase - suma("total_actualizado")) < 0.01 ? "COINCIDE" : "NO COINCIDE"}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e) => {
    console.error("ERROR:", e.message ?? e);
    process.exit(1);
  });
}
