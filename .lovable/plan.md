# Painel Financeiro — gráficos, análises automáticas e relatório em PDF

Tudo dentro da aba **Painel Financeiro** (Financeiro > Dashboard). Sem mudanças de banco.

## 1. Gráfico de pizza — Receitas do período

- Composição da Receita Bruta (grupo RB) por categoria do plano de contas, no ano/mês selecionado.
- Fatias ordenadas do maior para o menor, top 8 + "Outros", com valor em R$ e % no tooltip.
- Abaixo, um **texto automático** comparando com o mês anterior, por exemplo:
  "Receita Bruta de R$ 320.400 em Ago/2026, 12,3% acima de Jul/2026 (R$ 285.300). A maior contribuição veio de 'RB - Locação' (R$ 180.000, 56% do total), que cresceu 20% no mês."
  Inclui também a categoria com maior queda, quando houver.

## 2. Gráfico de barras horizontais — Custos Variáveis (CV)

- Somente as categorias do grupo CV, respeitando os mesmos filtros de ano/mês (e o filtro de categoria, quando ativo).
- Barras ordenadas por valor, com rótulo em R$ e altura dinâmica para não espremer os nomes.
- Texto automático no mesmo padrão: total de CV no mês, variação vs. mês anterior, % sobre a Receita Bruta e qual categoria puxou a variação.

## 3. Faturamento (Vendas) x Recebimento

Novo bloco comparando:

- **Faturamento do mês** — soma do valor final das vendas com **data de registro** dentro do mês selecionado (aba Comercial > Vendas).
- **Recebido no mês** — Receita Bruta realizada do próprio mês (o RB já usado no painel).
- **Índice de conversão em caixa** = Recebido / Faturado, com barra de progresso e o valor que ficou para os próximos meses.
- Texto automático explicando quanto do que foi vendido no mês entrou no caixa no mesmo mês e como isso se compara ao mês anterior.

## 4. Relatório em PDF

O botão atual "Imprimir" passa a **Exportar PDF** (download direto, A4 retrato) contendo:

1. Cabeçalho: "Painel Financeiro — Mês/Ano", empresa e data de emissão.
2. Os 5 cards de indicadores (Receita Bruta, Pot. de Vendas, Despesas, Custos, Lucro) com os percentuais.
3. Gráfico de pizza das receitas + o texto de análise.
4. Gráfico de barras de CV + o texto de análise.
5. Bloco Faturamento x Recebimento + texto.
6. **Demonstrativo somente por grupos** — apenas as linhas (+) Receita Bruta, (-) Deduções da Receita, (=) Receita Líquida etc. Sem as categorias detalhadas e sem a lista de lançamentos.

## Detalhes técnicos

- Arquivo principal: `src/components/financeiro/ContaAzulDashboard.tsx` (componente `PainelFinanceiro`).
- Gráficos com Recharts (`PieChart`, `BarChart layout="vertical"`), consistentes com o restante do app.
- Novo `src/lib/conta-azul/painel-analises.ts`: monta as séries (receitas por categoria, CV por categoria), calcula o mês anterior via `calcularDRECaixa(... mes-1)` e gera os textos automáticos.
- Vendas: reutilizar a mesma fonte da aba Comercial > Vendas (`src/lib/comercial/vendas.functions.ts`), somando `valorFinal` por `dataRegistro` no mês; sem novas consultas de banco além dessa leitura.
- PDF: novo `src/lib/conta-azul/painel-pdf.ts` com `jspdf` + `jspdf-autotable` (já usados no projeto); os gráficos são capturados dos containers Recharts via `html2canvas`/serialização do SVG e inseridos como imagem.
- A rotina de impressão por `@media print` do painel é substituída pela exportação em PDF.
