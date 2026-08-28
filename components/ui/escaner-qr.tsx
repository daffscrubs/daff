"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Detector nativo del navegador cuando está disponible (Chrome/Edge en
// Android, sobre todo) — más rápido y sin cargar el decodificador por
// software. Safari/iOS y navegadores viejos no lo tienen, por eso el
// fallback a @zxing/browser abajo, que decodifica cuadro por cuadro con
// getUserMedia y funciona en cualquier navegador.
interface DetectorNativo {
  detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opciones?: { formats: string[] }) => DetectorNativo;
  }
}

export function EscanerQRDialog({
  abierto,
  onOpenChange,
  onDetectado,
  titulo = "Escanear código",
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onDetectado: (codigo: string) => void;
  titulo?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detenerRef = useRef<(() => void) | null>(null);
  // El callback del caller casi siempre es una función nueva en cada render;
  // guardarlo en un ref evita reiniciar la cámara cada vez que el padre
  // vuelve a renderizar mientras el diálogo sigue abierto.
  const onDetectadoRef = useRef(onDetectado);
  const [error, setError] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");

  useEffect(() => {
    onDetectadoRef.current = onDetectado;
  }, [onDetectado]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    let rafId: number | null = null;
    let stream: MediaStream | null = null;

    function detenerTodo() {
      if (rafId != null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    }

    function detectado(codigo: string) {
      detenerRef.current?.();
      onDetectadoRef.current(codigo);
    }

    async function iniciar() {
      setError(null);
      try {
        if (typeof window !== "undefined" && window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (cancelado || !videoRef.current) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

          const detectarFrame = async () => {
            if (cancelado || !videoRef.current) return;
            try {
              const resultados = await detector.detect(videoRef.current);
              if (resultados.length > 0) {
                detectado(resultados[0].rawValue);
                return;
              }
            } catch {
              // sigue intentando en el siguiente cuadro
            }
            rafId = requestAnimationFrame(detectarFrame);
          };
          rafId = requestAnimationFrame(detectarFrame);
          detenerRef.current = detenerTodo;
        } else {
          const lector = new BrowserQRCodeReader();
          const controles = await lector.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (resultado) => {
            if (resultado) detectado(resultado.getText());
          });
          detenerRef.current = () => controles.stop();
        }
      } catch (err) {
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "No se pudo acceder a la cámara — revisa los permisos del navegador."
            : "No se pudo iniciar la cámara. Puedes escribir el código a mano abajo."
        );
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      detenerRef.current?.();
      detenerRef.current = null;
    };
  }, [abierto]);

  function enviarManual(e: React.FormEvent) {
    e.preventDefault();
    const codigo = codigoManual.trim();
    if (!codigo) return;
    setCodigoManual("");
    onDetectadoRef.current(codigo.toUpperCase());
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Apunta la cámara al código QR de la etiqueta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <form className="space-y-2" onSubmit={enviarManual}>
            <Label htmlFor="codigoManual">¿No escanea? Escribe el código a mano</Label>
            <div className="flex gap-2">
              <Input
                id="codigoManual"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                placeholder="TELA-AZUL-A1B2C3-0007"
                autoCapitalize="characters"
              />
              <Button type="submit" variant="outline">
                Usar
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
