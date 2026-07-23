## Objetivo
Reduzir o peso do carregamento inicial das rotas convertendo `xlsx`, `jspdf`/`jspdf-autotable` e `recharts` de imports estáticos para dinâmicos, sem alterar comportamento nem o code splitting já existente.

## 1. `xlsx` — import dinâmico dentro dos handlers

Arquivos afetados:
- `src/lib/import-utils.ts` — tornar `parseSpreadsheet` e `downloadTemplate` `async` e mover `const XLSX = await import("xlsx")` para dentro de cada função. Atualizar chamadores (ex. `ImportDialog` já faz `await parseSpreadsheet`; `downloadTemplate` passa a ser awaited no handler do botão, com estado "Gerando…").
- `src/components/estoque/ConferenciaEgestorDialog.tsx` — mover import para dentro da função de exportação/leitura, adicionando estado `busy` no botão.
- `src/routes/financeiro-op.diaristas.index.tsx` — mover para dentro do handler de exportação.
- `src/routes/contabil.apuracoes.tsx` — mover para dentro do handler "Exportar Excel"; já há dropdown com PDF/Excel, adicionar indicador de carregamento.

## 2. `jspdf` + `jspdf-autotable` — import dinâmico

Padrão: dentro da função geradora, `const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]); const autoTable = autoTableMod.default;`.

Arquivos:
- `src/lib/comercial/pdf.ts` — tornar a função de geração `async` e importar dinamicamente uma vez lá dentro. Atualizar todos os call sites para `await`.
- `src/routes/relatorios.tsx` — mover imports para o handler do botão "Gerar PDF", com estado de loading.
- `src/routes/financeiro-op.relatorios.tsx` — idem.

## 3. `recharts` — `lazy()` + `Suspense` por gráfico

Estratégia: para cada rota/componente que consome `recharts` e em que o gráfico não é o conteúdo imediato principal, extrair o bloco do gráfico para um componente filho em arquivo separado (mesma pasta, sufixo `.chart.tsx`) e importá-lo via `const Chart = lazy(() => import("./Foo.chart"))` com `<Suspense fallback={<div className="h-[300px]" />}>`.

Arquivos a converter (gráficos em abas/seções secundárias):
- `src/routes/comercial.dashboard.index.tsx`
- `src/routes/comercial.dashboard.propostas.tsx`
- `src/routes/comercial.dashboard.painel.tsx`
- `src/routes/financeiro.dashboard.tsx`
- `src/routes/patrimonio.dashboard.tsx`
- `src/routes/dashboard.tsx`
- `src/routes/compras.dashboard.tsx`
- `src/components/financeiro/ContaAzulDashboard.tsx`
- `src/components/financeiro/UberDashboard.tsx`
- `src/components/comercial/RelatorioVendasPeriodo.tsx`
- `src/components/comercial/dashboard/GaugeRealVsMeta.tsx`

Não alterar:
- `src/components/ui/chart.tsx` (wrapper genérico shadcn; já é reexportado só onde há gráfico e o lazy será feito no consumidor).

## Fora de escopo
- Não mexer em `AnexoViewer.tsx` nem `vendas-parse.server.ts` (já dinâmicos).
- Não alterar configuração de code splitting nem `vite.config.ts`.

## Verificação
- `bun run build` e confirmar que os chunks `xlsx`, `jspdf`, `jspdf-autotable` e `recharts` viram chunks separados, ausentes do bundle inicial e das rotas que não usam a função.
- Teste manual: importar planilha (Estoque/Diaristas), exportar Excel (Apuração), gerar PDF (Comercial/Relatórios/Diaristas) e abrir cada dashboard para ver gráficos renderizarem após pequeno fallback.

## Detalhes técnicos
- `import * as XLSX from "xlsx"` → `const XLSX = await import("xlsx")` (namespace).
- `import jsPDF from "jspdf"` → `const { jsPDF } = await import("jspdf")` (named em ESM moderno) — se o build reclamar, usar `const { default: jsPDF } = await import("jspdf")`.
- `import autoTable from "jspdf-autotable"` → `const autoTable = (await import("jspdf-autotable")).default`.
- `recharts`: componentes são named exports; o wrapper filho re-exporta o gráfico como `default` para permitir `React.lazy`.
