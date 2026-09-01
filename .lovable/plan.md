# Vendas por Período: ocultar vendedores zerados no Período A

## O que será feito

Na aba Relatórios do módulo Comercial, relatório **Vendas por Período**, o ranking **Vendedores** atualmente oculta apenas quem tem valor zerado nos **dois períodos** (A e B).

A alteração:

1. Ajustar o filtro do ranking **Vendedores** para ocultar qualquer vendedor cujo valor no **Período A** seja **R$ 0,00**, independentemente do valor no Período B.
2. A exportação **CSV** seguirá a lista filtrada automaticamente, pois já usa `rkVendedor` como fonte.
3. Se após o filtro não sobrar nenhum vendedor, o card continua exibindo a mensagem padrão "Sem dados no período.".

Os demais rankings (Categoria, Cerimonial, Decorador), KPIs e gráfico comparativo não serão alterados.

## Detalhes técnicos

- Arquivo: `src/components/comercial/RelatorioVendasPeriodo.tsx`
- Linha ~133: trocar `.filter((d) => d.A !== 0 || d.B !== 0)` por `.filter((d) => d.A !== 0)` no `useMemo` de `rkVendedor`.
