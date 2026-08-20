// Ordenação padrão dos relatórios de Patrimônio: Família → Nome → Medida.
// Ex.: "GRIDE Q25 | 3,00M" → família "GRIDE Q25", medida "3,00M" (3).

export type ItemOrdenavel = { nome?: string | null; especificacao?: string | null };

function partes(espec?: string | null) {
  const raw = (espec ?? "").trim();
  if (!raw) return { familia: "", medida: "", medidaNum: Number.POSITIVE_INFINITY };
  let familia = raw;
  let medida = "";
  const idx = raw.indexOf("|");
  if (idx >= 0) {
    familia = raw.slice(0, idx).trim();
    medida = raw.slice(idx + 1).trim();
  } else {
    // fallback: separa o primeiro trecho numérico com unidade (ex.: "GRIDE Q25 3,00M")
    const m = raw.match(/^(.*?)[\s-]+(\d+[.,]?\d*\s*[a-zA-Z]*)$/);
    if (m) {
      familia = m[1].trim();
      medida = m[2].trim();
    }
  }
  const n = medida.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return {
    familia,
    medida,
    medidaNum: n ? Number(n[0]) : Number.POSITIVE_INFINITY,
  };
}

export function compareFamiliaNomeMedida(a: ItemOrdenavel, b: ItemOrdenavel) {
  const pa = partes(a.especificacao);
  const pb = partes(b.especificacao);

  // itens sem especificação vão para o fim
  if (!pa.familia && pb.familia) return 1;
  if (pa.familia && !pb.familia) return -1;

  const fam = pa.familia.localeCompare(pb.familia, "pt-BR", { numeric: true, sensitivity: "base" });
  if (fam !== 0) return fam;

  const nome = (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { numeric: true, sensitivity: "base" });
  if (nome !== 0) return nome;

  if (pa.medidaNum !== pb.medidaNum) return pa.medidaNum - pb.medidaNum;
  return pa.medida.localeCompare(pb.medida, "pt-BR", { numeric: true, sensitivity: "base" });
}
