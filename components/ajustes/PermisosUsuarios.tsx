"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { guardarPermisosUsuario } from "@/actions/permisos.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { GRUPOS_PERMISOS, PERMISOS_POR_ROL, TODOS_LOS_PERMISOS } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types/database.types";

interface PerfilPermisos {
  id: string;
  nombre_completo: string;
  rol: RolUsuario;
  activo: boolean;
  permisos: string[];
}

const ROL_LABEL: Record<string, string> = { admin: "Administrador", ventas: "Ventas", supervisor: "Supervisor", colaborador: "Colaborador" };

// Casilla que admite el estado "algunos" (rayita), para los grupos con permisos marcados a medias.
function Casilla({
  marcada,
  parcial = false,
  onChange,
  etiqueta,
  deshabilitada,
}: {
  marcada: boolean;
  parcial?: boolean;
  onChange: () => void;
  etiqueta: string;
  deshabilitada?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer disabled:cursor-not-allowed"
      aria-label={etiqueta}
      checked={marcada}
      disabled={deshabilitada}
      ref={(el) => {
        if (el) el.indeterminate = parcial && !marcada;
      }}
      onChange={onChange}
    />
  );
}

function Editor({ perfil }: { perfil: PerfilPermisos }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(perfil.permisos));
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set([GRUPOS_PERMISOS[0].id]));
  const [guardando, startTransition] = useTransition();
  const esAdmin = perfil.rol === "admin";

  const cambios = useMemo(() => {
    const original = new Set(perfil.permisos);
    return seleccion.size !== original.size || [...seleccion].some((p) => !original.has(p));
  }, [seleccion, perfil.permisos]);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function alternarGrupo(ids: string[]) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      const todos = ids.every((id) => siguiente.has(id));
      ids.forEach((id) => (todos ? siguiente.delete(id) : siguiente.add(id)));
      return siguiente;
    });
  }

  function alternarTodos() {
    setSeleccion((prev) => (TODOS_LOS_PERMISOS.every((p) => prev.has(p)) ? new Set() : new Set(TODOS_LOS_PERMISOS)));
  }

  function guardar() {
    startTransition(async () => {
      const res = await guardarPermisosUsuario(perfil.id, [...seleccion]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Permisos de ${perfil.nombre_completo} guardados`);
      router.refresh();
    });
  }

  if (esAdmin) {
    return (
      <div className="flex items-start gap-3 rounded-xl border p-5">
        <ShieldCheck className="mt-0.5 size-5 text-primary" />
        <div>
          <p className="font-medium">Administrador: acceso completo</p>
          <p className="text-sm text-muted-foreground">
            Un administrador entra a todo y no se le puede restringir. Para quitarle el acceso, cámbiale el rol en Usuarios.
          </p>
        </div>
      </div>
    );
  }

  const todosMarcados = TODOS_LOS_PERMISOS.every((p) => seleccion.has(p));
  const algunoMarcado = TODOS_LOS_PERMISOS.some((p) => seleccion.has(p));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{perfil.nombre_completo}</h2>
          <p className="text-sm text-muted-foreground">Rol: {ROL_LABEL[perfil.rol] ?? perfil.rol}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={guardando}
            onClick={() => setSeleccion(new Set(PERMISOS_POR_ROL[perfil.rol]))}
          >
            Restablecer a los del rol
          </Button>
          <Button type="button" size="sm" disabled={!cambios || guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar permisos"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <Casilla marcada={todosMarcados} parcial={algunoMarcado} onChange={alternarTodos} etiqueta="Seleccionar todos los permisos" />
            Seleccionar todos los permisos
          </label>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setAbiertos((prev) => (prev.size === GRUPOS_PERMISOS.length ? new Set() : new Set(GRUPOS_PERMISOS.map((g) => g.id))))}
          >
            {abiertos.size === GRUPOS_PERMISOS.length ? "Contraer todo" : "Expandir todo"}
          </button>
        </div>

        {GRUPOS_PERMISOS.map((grupo) => {
          const ids = grupo.permisos.map((p) => p.id);
          const marcados = ids.filter((id) => seleccion.has(id)).length;
          const abierto = abiertos.has(grupo.id);
          return (
            <div key={grupo.id} className="border-b last:border-b-0">
              <div className="flex items-center justify-between px-4 py-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <Casilla
                    marcada={marcados === ids.length}
                    parcial={marcados > 0}
                    onChange={() => alternarGrupo(ids)}
                    etiqueta={`Seleccionar todo en ${grupo.titulo}`}
                  />
                  {grupo.titulo}
                </label>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  aria-expanded={abierto}
                  onClick={() =>
                    setAbiertos((prev) => {
                      const siguiente = new Set(prev);
                      if (siguiente.has(grupo.id)) siguiente.delete(grupo.id);
                      else siguiente.add(grupo.id);
                      return siguiente;
                    })
                  }
                >
                  {marcados}/{ids.length}
                  <ChevronDown className={cn("size-4 transition-transform", abierto && "rotate-180")} />
                </button>
              </div>
              {abierto && (
                <div className="space-y-1 px-4 pb-3 pl-11">
                  {grupo.id === "modulos" && (
                    <p className="pb-2 text-xs text-muted-foreground">
                      Permite entrar a la pantalla. Editar o borrar en ella sigue dependiendo del rol del usuario (administrador o
                      supervisor).
                    </p>
                  )}
                  {grupo.permisos.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md py-1.5 text-sm hover:bg-muted/40">
                      <Casilla marcada={seleccion.has(p.id)} onChange={() => alternar(p.id)} etiqueta={p.etiqueta} />
                      {p.etiqueta}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PermisosUsuarios({ perfiles }: { perfiles: PerfilPermisos[] }) {
  const [elegidoId, setElegidoId] = useState<string | null>(perfiles.find((p) => p.rol !== "admin")?.id ?? perfiles[0]?.id ?? null);
  const elegido = perfiles.find((p) => p.id === elegidoId) ?? null;

  if (!perfiles.length) {
    return <EstadoVacio icon={ShieldCheck} titulo="Sin usuarios" descripcion="Crea usuarios en la sección Usuarios para asignarles permisos." />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-1">
        <p className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuarios</p>
        {perfiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setElegidoId(p.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
              p.id === elegidoId && "border-primary bg-primary/5"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.nombre_completo}</span>
              <span className="text-xs text-muted-foreground">{ROL_LABEL[p.rol] ?? p.rol}</span>
            </span>
            {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
          </button>
        ))}
      </div>

      {/* key: al cambiar de usuario se reinicia el editor con sus permisos guardados */}
      {elegido && <Editor key={elegido.id + elegido.permisos.join(",")} perfil={elegido} />}
    </div>
  );
}
