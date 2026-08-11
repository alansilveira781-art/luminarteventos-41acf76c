const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa",
];

const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Escreve 1..999 por extenso. */
function ate999(n: number): string {
  if (n <= 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 20) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: { singular: string; plural: string }[] = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
  { singular: "trilhão", plural: "trilhões" },
];

/** Escreve um número inteiro por extenso (pt-BR). */
export function inteiroPorExtenso(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "zero";

  const grupos: number[] = [];
  let resto = n;
  while (resto > 0) {
    grupos.push(resto % 1000);
    resto = Math.floor(resto / 1000);
  }

  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const escala = ESCALAS[i] ?? { singular: "", plural: "" };
    if (i === 1) {
      partes.push(g === 1 ? "mil" : `${ate999(g)} mil`);
    } else if (i === 0) {
      partes.push(ate999(g));
    } else {
      partes.push(`${ate999(g)} ${g === 1 ? escala.singular : escala.plural}`);
    }
  }

  // Junção: "e" antes do último grupo quando ele for < 100 ou centena redonda.
  let texto = "";
  partes.forEach((p, idx) => {
    if (idx === 0) {
      texto = p;
      return;
    }
    const ultimo = idx === partes.length - 1;
    const grupoIdx = grupos.length - 1 - idx;
    const g = grupos[grupoIdx];
    const anteriorMil = grupoIdx + 1 === 1; // grupo anterior é o de milhar
    const usaE = ultimo && grupoIdx === 0 && (g < 100 || g % 100 === 0);
    texto += usaE ? ` e ${p}` : anteriorMil ? ` ${p}` : `, ${p}`;
  });
  return texto;
}

/** true quando o número é múltiplo exato de milhão/bilhão (pede "de reais"). */
function pedeDe(n: number): boolean {
  return n >= 1_000_000 && n % 1_000_000 === 0;
}

/** Escreve um valor monetário em reais por extenso. Ex.: "trinta mil reais". */
export function valorPorExtenso(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  const negativo = valor < 0;
  const total = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const partes: string[] = [];
  if (reais > 0)
    partes.push(
      `${inteiroPorExtenso(reais)} ${pedeDe(reais) ? "de " : ""}${reais === 1 ? "real" : "reais"}`,
    );
  if (centavos > 0)
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!partes.length) partes.push("zero real");

  return `${negativo ? "menos " : ""}${partes.join(" e ")}`;
}

