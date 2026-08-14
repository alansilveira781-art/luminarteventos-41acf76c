# Mover relatório de Cartões para Compras + vencimento de cartão em +30 dias

## 1. Seção "Cartões" muda de módulo

- Sai de **Financeiro › Relatórios** (a aba "Cartões" deixa de existir; ficam apenas "Análises" e "Classificação de Eventos", e a aba padrão passa a ser Análises).
- Entra em **Compras › Relatórios** como nova aba "Cartões", ao lado de "Importação Conta Azul", com exatamente os mesmos filtros, colunas, totais e exportações que existem hoje.

## 2. Vencimento dos lançamentos em cartão de crédito

Na aba de importação do Conta Azul, quando a forma de pagamento for cartão de crédito (formas cujo nome começa/contém "Cartão"):

- **Data de competência**: continua sendo a data da compra.
- **Data de vencimento**: 30 dias após a data da compra, mesmo à vista ou em 1x.
  - Compra em 14/08 → vencimento 14/09.
- **Parcelado**: cada parcela ganha um mês a mais.
  - 1ª = 14/09, 2ª = 14/10, 3ª = 14/11, e assim por diante.
- Demais formas (Pix, boleto, carteira etc.) continuam com a regra atual.

O deslocamento usa o mesmo dia do mês da compra; quando o mês seguinte não tem esse dia (ex.: 31/01), usa o último dia do mês.

## Detalhes técnicos

- `src/lib/conta-azul/exportacao-cards.ts`: adicionar helper `somarMeses` e `ehCartaoCredito(forma)`; em `linhasDoCard`, quando cartão, calcular o vencimento como `somarMeses(dataCompra, i + 1)` para toda parcela `i` (inclusive parcela única). Mantida a regra existente para as outras formas.
- `src/routes/financeiro-op.relatorios.tsx`: remover `CartoesReport`, o `TabsTrigger`/`TabsContent` "cartoes" e os imports/tipos usados só por ele (`Row`, `CartoesData`, `normForma`, constantes `TODAS`/`SEM_FORMA`).
- `src/routes/compras.relatorios.tsx`: incluir o componente movido como nova aba "Cartões" (extraído para `src/components/compras/CartoesReport.tsx` para o arquivo não ficar gigante), reaproveitando `normForma` de `@/lib/conta-azul/exportacao-cards`.
- Sem mudanças de banco de dados.
