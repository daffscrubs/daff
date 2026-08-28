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
  // El <video> se mantiene con tamaño real en el layout (no lo escondemos a
  // 1x1px): iOS parece suspender la decodificación de cuadros de un <video>
  // que considera "no visible de verdad" -- el intento anterior de ocultarlo
  // con sr-only (clip a 1x1px) puede haber disparado justo eso, dejando al
  // <video> sin cuadros que copiar al canvas. En su lugar, el <canvas> se
  // dibuja ENCIMA del video (mismo tamaño, position absolute) y es lo único
  // que el usuario ve. La detección de QR sigue leyendo del <video>
  // directamente.
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detenerRef = useRef<(() => void) | null>(null);
  // El callback del caller casi siempre es una función nueva en cada render;
  // guardarlo en un ref evita reiniciar la cámara cada vez que el padre
  // vuelve a renderizar mientras el diálogo sigue abierto.
  const onDetectadoRef = useRef(onDetectado);
  const [error, setError] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");

  useEffect(() => {
    onDetectadoRef.current = onDetectado;
  }, [onDetectado]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    let rafId: number | null = null;
    let espejoRafId: number | null = null;
    let stream: MediaStream | null = null;
    let watchdogId: ReturnType<typeof setTimeout> | null = null;

    // Si a los 2.5s el video sigue sin dimensiones o el track no está "live",
    // algo se detuvo en silencio (sin lanzar una excepción que el catch de
    // abajo pudiera atrapar) -- se muestra el estado real en pantalla para
    // no seguir adivinando a ciegas.
    function armarDiagnostico() {
      watchdogId = setTimeout(() => {
        if (cancelado) return;
        const video = videoRef.current;
        // En la rama de @zxing/browser no tenemos referencia directa al
        // stream (la maneja la librería internamente) -- pero sí queda en
        // srcObject del propio <video>, así que se lee de ahí para que el
        // diagnóstico sirva en ambas ramas.
        const streamActual = video?.srcObject instanceof MediaStream ? video.srcObject : stream;
        const track = streamActual?.getVideoTracks()[0];
        if (video && (!video.videoWidth || video.readyState < video.HAVE_CURRENT_DATA)) {
          setDiagnostico(
            `video: ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}, paused=${video.paused}` +
              (track ? ` · track: readyState=${track.readyState}, muted=${track.muted}, enabled=${track.enabled}` : " · sin track de video") +
              ` · UA=${navigator.userAgent}`
          );
        }
      }, 2500);
    }

    function iniciarEspejo() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      function dibujar() {
        if (cancelado || !video || !canvas) return;
        if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth) {
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
          ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        espejoRafId = requestAnimationFrame(dibujar);
      }
      espejoRafId = requestAnimationFrame(dibujar);
    }

    function detenerTodo() {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (espejoRafId != null) cancelAnimationFrame(espejoRafId);
      if (watchdogId != null) clearTimeout(watchdogId);
      stream?.getTracks().forEach((t) => t.stop());
    }

    function detectado(codigo: string) {
      detenerRef.current?.();
      onDetectadoRef.current(codigo);
    }

    async function iniciar() {
      setError(null);
      setDiagnostico(null);
      try {
        if (typeof window !== "undefined" && window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (cancelado || !videoRef.current) return;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          iniciarEspejo();
          armarDiagnostico();
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
          detenerRef.current = () => {
            controles.stop();
            detenerTodo();
          };
          // @zxing/browser ya deja el video reproduciendo; solo falta
          // empezar a copiar sus cuadros al canvas visible.
          iniciarEspejo();
          armarDiagnostico();
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
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {diagnostico && (
            <p className="rounded-md bg-muted p-2 font-mono text-xs break-all text-muted-foreground">
              {diagnostico}
            </p>
          )}
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
