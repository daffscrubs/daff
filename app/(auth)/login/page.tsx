"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  dominioColaborador,
  loginColaboradorSchema,
  loginPersonalSchema,
  type LoginColaboradorInput,
  type LoginPersonalInput,
} from "@/lib/validaciones/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const formPersonal = useForm<LoginPersonalInput>({
    resolver: zodResolver(loginPersonalSchema),
    defaultValues: { email: "", password: "" },
  });

  const formColaborador = useForm<LoginColaboradorInput>({
    resolver: zodResolver(loginColaboradorSchema),
    defaultValues: { usuarioCorto: "", pin: "" },
  });

  async function iniciarSesion(email: string, password: string) {
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image src="/brand/logo-full-trimmed.png" alt="daff" width={92} height={125} className="mb-1" priority />
          <CardDescription>Inicia sesión para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="colaborador">
            <TabsList className="w-full">
              <TabsTrigger value="colaborador" className="flex-1">Colaborador</TabsTrigger>
              <TabsTrigger value="personal" className="flex-1">Administración</TabsTrigger>
            </TabsList>

            <TabsContent value="colaborador" className="mt-4">
              <form
                className="space-y-4"
                onSubmit={formColaborador.handleSubmit((datos) =>
                  iniciarSesion(`${datos.usuarioCorto}@${dominioColaborador}`, datos.pin)
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="usuarioCorto">Usuario</Label>
                  <Input
                    id="usuarioCorto"
                    placeholder="martha"
                    autoCapitalize="none"
                    {...formColaborador.register("usuarioCorto")}
                  />
                  {formColaborador.formState.errors.usuarioCorto && (
                    <p className="text-sm text-destructive">
                      {formColaborador.formState.errors.usuarioCorto.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN (6 dígitos)</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    {...formColaborador.register("pin")}
                  />
                  {formColaborador.formState.errors.pin && (
                    <p className="text-sm text-destructive">
                      {formColaborador.formState.errors.pin.message}
                    </p>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="personal" className="mt-4">
              <form
                className="space-y-4"
                onSubmit={formPersonal.handleSubmit((datos) =>
                  iniciarSesion(datos.email, datos.password)
                )}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" placeholder="tu@taller.com" {...formPersonal.register("email")} />
                  {formPersonal.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {formPersonal.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" {...formPersonal.register("password")} />
                  {formPersonal.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {formPersonal.formState.errors.password.message}
                    </p>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
