"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { importarProductosExcel, type ResultadoImportacion } from "@/actions/inventarioImportar.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ImportarProductosDialog() {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) {
      toast.error("Selecciona un archivo");
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", archivo);
        const res = await importarProductosExcel(formData);
        setResultado(res);
        if (res.creados) {
          toast.success(`${res.creados} producto${res.creados === 1 ? "" : "s"} creado${res.creados === 1 ? "" : "s"}`);
          router.refresh();
        } else if (!res.errores.length) {
          toast.error("No se encontraron filas para importar");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al importar");
      }
    });
  }

  function cerrar(v: boolean) {
    setAbierto(v);
    if (!v) {
      setArchivo(null);
      setResultado(null);
      setInputKey((k) => k + 1);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-4" />
        Cargar Excel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargar productos desde Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              Descarga la plantilla, llena una fila por producto y vuelve a subirla aquí.
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<a href="/api/inventario/plantilla" />}
              nativeButton={false}
            >
              <Download className="size-4" />
              Descargar plantilla
            </Button>
          </div>

          <form className="space-y-3" onSubmit={subir}>
            <Input
              key={inputKey}
              type="file"
              accept=".xlsx"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Button type="submit" className="w-full" disabled={pendiente || !archivo}>
              {pendiente ? "Importando..." : "Subir e importar"}
            </Button>
          </form>

          {resultado && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {resultado.creados} producto{resultado.creados === 1 ? "" : "s"} creado{resultado.creados === 1 ? "" : "s"}
              </p>
              {!!resultado.errores.length && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                  <p className="mb-1 font-medium text-destructive">
                    {resultado.errores.length} fila{resultado.errores.length === 1 ? "" : "s"} con problemas:
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {resultado.errores.map((e, i) => (
                      <li key={i}>Fila {e.fila}: {e.mensaje}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
