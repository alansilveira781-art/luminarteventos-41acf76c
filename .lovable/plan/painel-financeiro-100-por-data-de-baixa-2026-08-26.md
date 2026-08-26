# Painel Financeiro 100% por data de baixa

O painel passa a refletir apenas o que foi efetivamente liquidado: valor da baixa e data da baixa, tanto em recebimentos quanto em pagamentos. O critério de vencimento sai dos cards, do demonstrativo e do gráfico anual.

## 1. Cards de recebido e pago

- Recebido e Pago somam exclusivamente as baixas (`ca_lancamento_baixas`) cuja `data_baixa` cai no período selecionado, sem exigir que o título tenha vencimento no mês.
- O carregamento dos títulos deixa de partir do vencimento: primeiro buscam-se as baixas do período, depois os títulos correspondentes por ID. O título serve só para classificar (categoria, centro de custo, descrição, fornecedor/cliente); o valor considerado é o da baixa.
- Baixa sem título correspondente deixa de ser descartada silenciosamente: passa a ser contabilizada como "sem categoria" e sinalizada, para que nenhum valor liquidado suma do painel.
- Transferências entre contas continuam excluídas.
- "A receber" e "A pagar" seguem sendo previsões e continuam por vencimento (é o único critério possível para o que ainda não foi liquidado); ficam visualmente identificados como previsão.

## 2. Demonstrativo (DRE) e lançamentos

- O regime de caixa usa a data da baixa como período, e o valor pago/recebido é distribuído entre as fatias de rateio do título na proporção de cada fatia, preservando a classificação por categoria e centro de custo.
- A lista de lançamentos do mês mostra a data da baixa e o valor da baixa (parciais aparecem como linhas próprias).

## 3. Gráfico Custo de operação x Receita

- Base: todas as baixas do ano, mês a mês, pela `data_baixa`.
- Receita do mês = Receita Bruta (categorias RB) recebida no mês.
- Custo de operação = soma de DR, AC, DM, DC, CV, CD, CI, DS, DA, DT, DF pagos no mês (Investimentos, Outras Saídas e subtotais ficam de fora).
- Sai a heurística de "mês incompleto": todo mês com movimento entra na série e aparece no gráfico.
- Média = índice consolidado ponderado do ano: soma dos custos ÷ soma das receitas, considerando todos os meses fechados. O mês corrente aparece no gráfico, mas fica fora da média.
- Tooltip: receita recebida, custo total, percentual e a composição grupo a grupo.

## 4. Conferência dos dados vindos da Conta Azul

- Auditoria por mês de 2026 comparando, no banco, o total de baixas com os títulos marcados como pagos, para identificar meses em que o sincronismo não gravou as liquidações.
- Onde houver lacuna, o reprocessamento de liquidações é executado pelo período de pagamento para completar `ca_lancamento_baixas` e os rateios das fatias.
- Validação final no próprio painel: cards, demonstrativo e gráfico devem fechar com a soma das baixas do período.

## Detalhes técnicos

- `src/lib/conta-azul/dre.ts`: `calcularIndicadoresCaixa` passa a somar baixas sem depender do conjunto de títulos carregados por vencimento; `expandirBaixas` trata baixa órfã; regime "caixa" sempre ancorado em `data_baixa`.
- `src/components/financeiro/ContaAzulDashboard.tsx`: `useContaAzulData` deixa de consultar títulos por `data_vencimento` no fluxo de caixa (mantém a consulta de vencimento apenas para os blocos de previsão); remove o parâmetro `temCobertura` do gráfico.
- `src/lib/conta-azul/painel-analises.ts`: `COMPOSICAO_OPERACAO` fixada nos 11 grupos acordados; `serieCustoOperacao` sem a flag de mês incompleto; `mediaMesesCompletos` vira média consolidada ponderada, excluindo apenas o mês corrente.
- Consultas de auditoria via SQL de leitura; reprocessamento pela tela de sincronismo existente.
