// Relatório de impressão da Distribuição de Bonificação (janela própria, A4 retrato).

export type LinhaRelatorio = {
  eventoKey: string;
  evento: string;
  local: string | null;
  data: string | null; // ISO yyyy-mm-dd
  categoria: string | null;
  produtor: string | null;
  peso: number | null;
  valor: number;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export function gerarRelatorioBonificacao(params: {
  titulo: string;
  subtitulo?: string;
  linhas: LinhaRelatorio[];
}): boolean {
  const { titulo, subtitulo, linhas } = params;

  // Agrupa por evento preservando a ordem de entrada.
  const grupos: { key: string; itens: LinhaRelatorio[] }[] = [];
  const idx = new Map<string, number>();
  for (const l of linhas) {
    const i = idx.get(l.eventoKey);
    if (i === undefined) {
      idx.set(l.eventoKey, grupos.length);
      grupos.push({ key: l.eventoKey, itens: [l] });
    } else {
      grupos[i].itens.push(l);
    }
  }

  const totalGeral = linhas.reduce((s, l) => s + Number(l.valor || 0), 0);

  const porProdutor = (() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    for (const l of linhas) {
      const nome = l.produtor || "— Sem produtor —";
      const cur = map.get(nome) ?? { nome, qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += Number(l.valor || 0);
      map.set(nome, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  })();

  const rowsHtml = grupos
    .map((g) =>
      g.itens
        .map((l, i) => {
          const span = g.itens.length;
          const head =
            i === 0
              ? `<td rowspan="${span}">${esc(l.evento)}</td>` +
                `<td rowspan="${span}">${esc(l.local || "—")}</td>` +
                `<td rowspan="${span}" class="nowrap">${fmtData(l.data)}</td>` +
                `<td rowspan="${span}">${esc(l.categoria || "—")}</td>`
              : "";
          return (
            `<tr>${head}` +
            `<td>${esc(l.produtor || "—")}</td>` +
            `<td class="num">${l.peso ?? "—"}</td>` +
            `<td class="num">${fmtBRL(l.valor)}</td></tr>`
          );
        })
        .join(""),
    )
    .join("");

  const resumoHtml = porProdutor
    .map(
      (p) =>
        `<tr><td>${esc(p.nome)}</td><td class="num">${p.qtd}</td><td class="num">${fmtBRL(p.total)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 22px 0 6px; }
  .meta { font-size: 11px; color: #555; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; text-transform: uppercase; font-size: 9px; letter-spacing: .04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  tfoot td { font-weight: 700; background: #f3f4f6; }
  .foot { margin-top: 18px; font-size: 9px; color: #777; }
</style></head><body>
<h1>${esc(titulo)}</h1>
<div class="meta">${subtitulo ? esc(subtitulo) + " · " : ""}Gerado em ${new Date().toLocaleString("pt-BR")}</div>

<table>
  <thead><tr>
    <th>Nome do evento</th><th>Local</th><th>Data</th><th>Categoria</th>
    <th>Produtor</th><th class="num">Peso</th><th class="num">Valor</th>
  </tr></thead>
  <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#666">Nenhum lançamento no período.</td></tr>`}</tbody>
  <tfoot><tr><td colspan="6">Total geral</td><td class="num">${fmtBRL(totalGeral)}</td></tr></tfoot>
</table>

<h2>Total por produtor</h2>
<table>
  <thead><tr><th>Produtor</th><th class="num">Lançamentos</th><th class="num">Total</th></tr></thead>
  <tbody>${resumoHtml || `<tr><td colspan="3" style="text-align:center;padding:12px;color:#666">—</td></tr>`}</tbody>
  <tfoot><tr><td>Total geral</td><td class="num">${linhas.length}</td><td class="num">${fmtBRL(totalGeral)}</td></tr></tfoot>
</table>

<div class="foot">Relatório de distribuição de bonificação por produtor.</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
