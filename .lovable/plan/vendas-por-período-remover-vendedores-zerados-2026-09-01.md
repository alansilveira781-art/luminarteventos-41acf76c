# Vendas por Período: remover vendedores zerados

## O que será feito

Na aba Relatórios do módulo Comercial, relatório **Vendas por Período**, o card de ranking **Vendedores** hoje lista todos os consultores que têm qualquer registro nos períodos A ou B — incluindo os que ficam com valor zerado nos dois períodos.

A alteração:

1. Filtrar o ranking de **Vendedores** para ocultar vendedores cujo valor seja **R$ 0,00 nos dois períodos** (A e B). Quem vendeu em qualquer um dos períodos continua aparecendo normalmente.
2. Aplicar o mesmo filtro na exportação **CSV**, para que a seção "Vendedores" do arquivo bata com o que aparece na tela.
3. Se após o filtro não sobrar nenhum vendedor, o card exibe a mensagem padrão "Sem dados no período.".

Os demais rankings (Categoria, Cerimonial, Decorador) e os KPIs/gráfico comparativo não serão alterados.

## Detalhes técnicos

- Arquivo: `src/components/comercial/RelatorioVendasPeriodo.tsx`
- No `useMemo` de `rkVendedor`, aplicar `.filter((d) => d.A !== 0 || d.B !== 0)` sobre o resultado de `combinaRanking`.
- No `exportarCSV`, a seção "Vendedores" passa a usar essa mesma lista filtrada (o `rkVendedor` filtrado já é a fonte, então o CSV segue automaticamente).
