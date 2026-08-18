import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <Image src="/brand/logo-mark.png" alt="daff" width={48} height={46} />
      <div>
        <p className="text-lg font-semibold">Página no encontrada</p>
        <p className="text-sm text-muted-foreground">La página que buscas no existe o fue movida.</p>
      </div>
      <Button render={<Link href="/" />} nativeButton={false}>
        Volver al inicio
      </Button>
    </div>
  );
}
