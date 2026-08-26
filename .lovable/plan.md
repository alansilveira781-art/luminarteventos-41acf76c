# Reverter o Painel Financeiro ao comportamento correto

## O que aconteceu (confirmado na base)

A rotina de sincronização passou a buscar o "detalhe" de cada lançamento no Conta Azul e regravar o registro com esse retorno. Esse payload de detalhe não traz a categoria do plano de contas, então a regravação **apagou a categoria** de 900 contas a receber e 867 contas a pagar — incluindo 61 dos 64 recebimentos pagos de agosto/2026.

Por isso o painel mostra Receita Bruta de R$ 43.166,67: só sobraram 3 lançamentos com categoria. Os outros R$ 1.148.350,53 ficaram fora do DRE por estarem sem categoria.

Além disso, o cálculo de "Recebido/Pago no mês" foi trocado para somar as baixas individuais, o que também mudou os números:

- Contas a receber pagas com vencimento em agosto: **R$ 1.191.517,20** (bate com os R$ 1.191.796,68 do Conta Azul)
- Pelo critério novo (baixas/data de pagamento): R$ 955.759,58 — errado

## O que será feito

1. **Voltar o critério do painel e do DRE ao que era**: lançamento com status "pago" entra no mês do seu vencimento; lançamento em aberto/atrasado entra em "a receber"/"a pagar" pelo vencimento. Sem uso das baixas individuais.
2. **Voltar o valor do lançamento para o valor total** do título, sem substituir pelo valor liquidado parcial.
3. **Restaurar as categorias apagadas** dos 1.767 lançamentos, reaproveitando a categoria já registrada nos rateios de cada lançamento (disponível para 902 das contas a receber afetadas) e, no que faltar, ressincronizando a categoria pela listagem do Conta Azul.
4. **Impedir que volte a acontecer**: a regravação com o detalhe passa a preservar categoria e centro de custo quando o detalhe não os traz, em vez de gravar nulo.

## Validação

Depois do ajuste, agosto/2026 deve mostrar Receita Bruta próxima de R$ 1.191.517 e pagos próximos de R$ 1.054.415, com as categorias voltando ao gráfico de receitas e ao demonstrativo.

## Detalhes técnicos

- `src/lib/conta-azul/dre.ts`: `passaVisao` volta a usar `data_vencimento` para o realizado; `calcularIndicadoresCaixa` deixa de somar `ca_lancamento_baixas` e volta a somar títulos com `status = 'pago'` por vencimento (mantendo a exclusão de transferências).
- Chamadas que passam baixas (Painel `src/routes/painel.tsx` e `ContaAzulDashboard`) deixam de carregar/passar esse dado.
- `src/lib/conta-azul/sync.server.ts`: `mapEvento` volta a gravar `valor` = total do título; na regravação pós-enrichment, categoria/centro de custo só são gravados quando presentes no payload.
- Correção de dados via SQL: `UPDATE` em `ca_contas_receber`/`ca_contas_pagar` preenchendo `categoria_external_id` a partir de `ca_lancamento_rateios` (maior fatia por lançamento) onde está nulo.
- A tabela `ca_lancamento_baixas` permanece na base, apenas deixa de alimentar os indicadores.
