import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

const RUTAS_ADMIN = ["/dashboard", "/clientes", "/pedidos", "/produccion", "/catalogos", "/materiales", "/entregas", "/reportes", "/usuarios"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPantallaLogin = pathname.startsWith("/login");

  if (!user) {
    if (esPantallaLogin) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  const rol = perfil?.rol;
  const inicioSegunRol = rol === "colaborador" ? "/mi-dia" : "/dashboard";

  if (esPantallaLogin || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = inicioSegunRol;
    return NextResponse.redirect(url);
  }

  const esRutaAdmin = RUTAS_ADMIN.some((r) => pathname.startsWith(r));
  if (esRutaAdmin && rol === "colaborador") {
    const url = request.nextUrl.clone();
    url.pathname = "/mi-dia";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
