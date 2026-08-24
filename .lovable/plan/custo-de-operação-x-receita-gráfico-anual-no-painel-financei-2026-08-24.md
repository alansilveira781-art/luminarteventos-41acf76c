# Custo de Operação x Receita — gráfico anual no Painel Financeiro

Novo card logo abaixo de "Faturamento (Vendas) x Recebimento", no Painel Financeiro (Financeiro > Dashboard).

## O que mostra

Para cada mês de janeiro a dezembro do **ano selecionado** (não muda ao trocar o filtro de mês):

- Barra 1 — **Receita Bruta** do mês (mesmo RB do painel, regime de caixa).
- Barra 2 — **Custo de operação**: soma de Potencial de Vendas (Aquisição de Clientes + Marketing + Comerciais) + Despesas (Sócio + Administrativas + Tributárias) + Custos (Variáveis + Diretos + Indiretos), em valor absoluto.
- Linha — **% de operação** = custo de operação ÷ receita bruta do mês, no eixo direito (%). Meses sem receita ficam sem ponto na linha.

Cores da paleta atual do financeiro: grafite para receita, terracota para custo de operação, âmbar para a linha.

## Card de média

Ao lado do título, um card destacado com a **média do percentual dos meses completos** do ano exibido (exclui o mês corrente e meses futuros), com o texto do tipo:

"Em média, 78,4% da receita é consumida para operar a empresa (média de 7 meses completos de 2026)."

Abaixo do gráfico, uma linha curta indicando o melhor e o pior mês do período.

## Detalhes técnicos

- `src/components/financeiro/ContaAzulDashboard.tsx` (componente `PainelFinanceiro`): novo bloco `<Card>` após o de Faturamento x Recebimento.
- Dados: chamar `useContaAzulData(anoEfetivo, 0)` (mês 0 = ano inteiro, já suportado por `buildPeriodo`) e rodar `calcularDRECaixa` por mês (1..12) sobre esse mesmo conjunto, sem novas consultas por mês.
- Nova função em `src/lib/conta-azul/painel-analises.ts`: `serieCustoOperacao(pagar, receber, planoMap, ano, dreEstrutura)` retornando `{ mes, receita, custoOperacao, pct }[]`, além de `mediaMesesCompletos(serie, ano)`.
- Gráfico com Recharts `ComposedChart` (duas `Bar` + uma `Line`, `YAxis` duplo), consistente com os demais gráficos do painel.
- Cores de `src/lib/financeiro/chart-colors.ts` (`CHART_BASE`, `CHART_NEGATIVE`, `CHART_ACCENT`).
- Sem mudanças de banco e sem alterar cálculos existentes do DRE.
