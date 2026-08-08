/** Converte texto livre em lista de códigos numéricos.
 * Aceita separadores (vírgula, ponto-e-vírgula, espaço, quebra de linha)
 * e intervalos: "101-105, 120, 131 a 133" -> [101,102,103,104,105,120,131,132,133]
 */
export function parseCods(text: string): number[] {
  const out = new Set<number>();
  for (const part of String(text).split(/[,;\n\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*[-–a]\s*(\d+)$/i);
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (a > b) [a, b] = [b, a];
      if (b - a > 2000) continue;
      for (let i = a; i <= b; i++) out.add(i);
    } else if (/^\d+$/.test(part)) {
      out.add(Number(part));
    }
  }
  return Array.from(out).sort((x, y) => x - y);
}
