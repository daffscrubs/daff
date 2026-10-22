// Supabase devuelve como máximo 1,000 filas por consulta (sin avisar), así que una tabla que
// crece más allá de eso se lee "incompleta" y las pantallas muestran datos faltantes (p. ej.
// productos con existencias que salen como "Sin existencias"). Esta función lee la tabla por
// páginas hasta traerla completa. La consulta debe llevar un .order() estable para que las
// páginas no se traslapen ni se salten filas.
const TAMANO_PAGINA = 1000;

type RespuestaPagina<T> = { data: T[] | null; error: { message: string } | null };

export async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await consulta(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { data: filas, error };
    filas.push(...(data ?? []));
    if ((data?.length ?? 0) < TAMANO_PAGINA) break;
  }
  return { data: filas, error: null };
}
