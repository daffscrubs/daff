// Arranca la app contra el proyecto de PRUEBAS de Supabase (daffpruebaqr) sin tocar .env.local (producción).
//
//   1) cp .env.pruebas.example .env.pruebas.local   y pega las llaves del proyecto de pruebas
//   2) npm run dev:pruebas
//
// Por seguridad se niega a arrancar si el archivo no existe, si faltan llaves o si apunta al MISMO proyecto que
// .env.local (producción). Las variables del proceso tienen prioridad sobre .env.local, por eso basta con cargarlas.
import fs from "node:fs";
import { spawn } from "node:child_process";

const ARCHIVO = ".env.pruebas.local";
const LLAVES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

function leerEnv(ruta) {
  if (!fs.existsSync(ruta)) return null;
  const env = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split("\n")) {
    const t = linea.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    env[t.slice(0, t.indexOf("="))] = t.slice(t.indexOf("=") + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}
const proyecto = (url) => {
  try {
    return new URL(url).host.split(".")[0];
  } catch {
    return null;
  }
};

const pruebas = leerEnv(ARCHIVO);
if (!pruebas) {
  console.error(`No existe ${ARCHIVO}. Copia .env.pruebas.example como ${ARCHIVO} y pega las llaves del proyecto de pruebas (daffpruebaqr).`);
  process.exit(1);
}
const faltan = LLAVES.filter((k) => !pruebas[k]);
if (faltan.length) {
  console.error(`Faltan valores en ${ARCHIVO}: ${faltan.join(", ")}`);
  process.exit(1);
}
const produccion = leerEnv(".env.local");
if (produccion && proyecto(produccion.NEXT_PUBLIC_SUPABASE_URL) === proyecto(pruebas.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error(`${ARCHIVO} apunta al MISMO proyecto que .env.local (producción: ${proyecto(pruebas.NEXT_PUBLIC_SUPABASE_URL)}). Pon las llaves del proyecto de pruebas.`);
  process.exit(1);
}

console.log(`\n>>> Modo PRUEBAS: la app usará el proyecto de Supabase "${proyecto(pruebas.NEXT_PUBLIC_SUPABASE_URL)}" (no producción).\n`);
const hijo = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...pruebas },
});
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
