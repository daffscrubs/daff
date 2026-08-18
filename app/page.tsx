import { redirect } from "next/navigation";

// El middleware ya redirige "/" según sesión y rol; esto es solo un respaldo.
export default function Home() {
  redirect("/login");
}
