"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  ajusteAvanceSchema,
  registrarAvanceSchema,
  type AjusteAvanceInput,
  type RegistrarAvanceInput,
} from "@/lib/validaciones/avance.schema";

function mensajeError(error: { message: string }) {
  if (error.message.includes("excede el avance disponible")) {
    return "La cantidad excede el avance disponible de la etapa anterior.";
  }
  if (error.message.includes("negativo")) {
    return "El ajuste dejaría el acumulado en negativo.";
  }
  return error.message;
}

export async function crearRegistroAvance(input: RegistrarAvanceInput) {
  const perfil = await requerirPerfil();
  const datos = registrarAvanceSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("registros_avance_colaborador").insert({
    colaborador_id: perfil.id,
    registrado_por: perfil.id,
    lote_id: datos.loteId,
    lote_etapa_id: datos.loteEtapaId,
    origen: "colaborador",
    cantidad: datos.cantidad,
    observaciones: datos.observaciones || null,
    foto_url: datos.fotoUrl || null,
  });

  if (error) throw new Error(mensajeError(error));

  revalidatePath("/mi-dia");
  revalidatePath("/mi-historial");
  revalidatePath(`/produccion/${datos.loteId}`);
}

export async function crearAjusteAvance(input: AjusteAvanceInput) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = ajusteAvanceSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("registros_avance_colaborador").insert({
    colaborador_id: datos.colaboradorId,
    registrado_por: perfil.id,
    lote_id: datos.loteId,
    lote_etapa_id: datos.loteEtapaId,
    origen: "ajuste_supervisor",
    cantidad: datos.cantidad,
    observaciones: datos.observaciones,
  });

  if (error) throw new Error(mensajeError(error));

  revalidatePath(`/produccion/${datos.loteId}`);
  revalidatePath("/reportes/productividad");
}
