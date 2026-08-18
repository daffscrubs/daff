import { Scissors, Shirt, CheckCircle2, Package, Layers, type LucideIcon } from "lucide-react";

interface EtapaVisual {
  icon: LucideIcon;
  color: string;
}

const VISUALES: Record<string, EtapaVisual> = {
  corte: { icon: Scissors, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
  confección: { icon: Shirt, color: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
  confeccion: { icon: Shirt, color: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
  terminado: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950" },
  empaque: { icon: Package, color: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
};

export function visualEtapa(nombreEtapa: string): EtapaVisual {
  return VISUALES[nombreEtapa.trim().toLowerCase()] ?? { icon: Layers, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" };
}
