import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Image src="/brand/logo-mark.png" alt="Cargando" width={40} height={38} className="animate-pulse" />
    </div>
  );
}
