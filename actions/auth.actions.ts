"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

export async function iniciarSesion(identificador: string, email: string, password: string) {
  const admin = createAdminClient();
  const idNormalizado = identificador.toLowerCase().trim();

  const { data: registro } = await admin
    .from("intentos_login")
    .select("intentos, bloqueado_hasta")
    .eq("identificador", idNormalizado)
    .maybeSingle();

  if (registro?.bloqueado_hasta && new Date(registro.bloqueado_hasta) > new Date()) {
    const minutosRestantes = Math.ceil((new Date(registro.bloqueado_hasta).getTime() - Date.now()) / 60000);
    return { error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const intentos = (registro?.intentos ?? 0) + 1;
    const bloqueado = intentos >= MAX_INTENTOS;

    await admin.from("intentos_login").upsert({
      identificador: idNormalizado,
      intentos: bloqueado ? 0 : intentos,
      bloqueado_hasta: bloqueado ? new Date(Date.now() + BLOQUEO_MINUTOS * 60000).toISOString() : null,
      actualizado_at: new Date().toISOString(),
    });

    if (bloqueado) {
      return { error: `Demasiados intentos fallidos. Intenta de nuevo en ${BLOQUEO_MINUTOS} minutos.` };
    }
    return { error: "Usuario o contraseña incorrectos." };
  }

  if (registro) {
    await admin.from("intentos_login").delete().eq("identificador", idNormalizado);
  }

  return { error: null };
}
