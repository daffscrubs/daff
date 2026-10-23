// Código de barras Code 128 (el estándar de las etiquetas de producto), sin librerías
// externas. Devuelve la secuencia de módulos ("1" = barra, "0" = espacio) para dibujarla
// directamente en el PDF como rectángulos, lo que mantiene los bordes nítidos a cualquier
// resolución de impresión.

// Anchos (barra, espacio, barra...) de los 107 símbolos del estándar; el último es el de paro.
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

const INICIO_B = 104;
const INICIO_C = 105;
const CAMBIO_A_C = 99;
const CAMBIO_A_B = 100;
const PARO = 106;

const esDigito = (texto: string, i: number) => i < texto.length && texto[i] >= "0" && texto[i] <= "9";

function digitosSeguidos(texto: string, desde: number): number {
  let n = 0;
  while (esDigito(texto, desde + n)) n++;
  return n;
}

/** Valores de los símbolos (inicio, datos, dígito verificador y paro) para un texto ASCII imprimible. */
export function simbolosCode128(texto: string): number[] {
  if (!texto) throw new Error("El código de barras no puede estar vacío");
  for (const c of texto) {
    const codigo = c.charCodeAt(0);
    if (codigo < 32 || codigo > 126) throw new Error(`Carácter no válido para código de barras: "${c}"`);
  }

  // Con 4 o más dígitos seguidos conviene el juego C (dos dígitos por símbolo: código más corto).
  let modoC = digitosSeguidos(texto, 0) >= 4;
  const valores: number[] = [modoC ? INICIO_C : INICIO_B];
  let i = 0;
  while (i < texto.length) {
    if (!modoC) {
      if (digitosSeguidos(texto, i) >= 4) {
        valores.push(CAMBIO_A_C);
        modoC = true;
        continue;
      }
      valores.push(texto.charCodeAt(i) - 32);
      i++;
    } else if (esDigito(texto, i) && esDigito(texto, i + 1)) {
      valores.push(Number(texto.slice(i, i + 2)));
      i += 2;
    } else {
      valores.push(CAMBIO_A_B); // sobra un dígito suelto o sigue un carácter que no es dígito
      modoC = false;
    }
  }

  let suma = valores[0];
  for (let p = 1; p < valores.length; p++) suma += valores[p] * p;
  valores.push(suma % 103, PARO);
  return valores;
}

/** Módulos del código ("1" barra, "0" espacio), sin zona de silencio. */
export function modulosCode128(texto: string): string {
  let modulos = "";
  for (const simbolo of simbolosCode128(texto)) {
    let barra = true;
    for (const ancho of PATRONES[simbolo]) {
      modulos += (barra ? "1" : "0").repeat(Number(ancho));
      barra = !barra;
    }
  }
  return modulos;
}

/** Tramos consecutivos de barras: [inicio, ancho] en módulos, listos para dibujar un rectángulo cada uno. */
export function barrasCode128(texto: string): { inicio: number; ancho: number }[] {
  const modulos = modulosCode128(texto);
  const barras: { inicio: number; ancho: number }[] = [];
  for (let i = 0; i < modulos.length; ) {
    if (modulos[i] === "0") {
      i++;
      continue;
    }
    let fin = i;
    while (fin < modulos.length && modulos[fin] === "1") fin++;
    barras.push({ inicio: i, ancho: fin - i });
    i = fin;
  }
  return barras;
}
