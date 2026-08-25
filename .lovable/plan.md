# Corrigir indicadores financeiros do Painel

## O problema

Os cards "Recebido no mês", "Pago no mês" e "Saldo de caixa" mostram R$ 0,00 porque o Painel filtra pela **data de pagamento**, e na base sincronizada do Conta Azul esse campo está vazio em 100% dos lançamentos (verificado: 2.763 recebimentos e 41.513 pagamentos com status "pago" e data de pagamento nula).

O dashboard do módulo Financeiro não tem esse problema porque considera um lançamento como realizado quando o **status é "pago"**, usando a data de pagamento e, quando ela não existe, a **data de vencimento** como referência do período.

## O que será ajustado

Em `/painel`, alinhar o bloco financeiro ao critério do dashboard financeiro (regime de caixa):

- Recebido no mês: soma dos recebimentos com status "pago" cuja data de pagamento (ou, na falta dela, o vencimento) cai no mês.
- Pago no mês: mesma regra para as contas a pagar.
- A receber / A pagar: soma dos lançamentos ainda não pagos com vencimento no mês (mantendo o comportamento atual, mas baseado no status em vez da data de pagamento nula).
- Saldo de caixa: recebido menos pago, agora com valores reais.

Também serão desconsiderados os lançamentos de transferência entre contas, como já ocorre no dashboard financeiro, para os números baterem entre as duas telas.

## Detalhes técnicos

- Arquivo: `src/routes/painel.tsx`, query `painel-financeiro`.
- Substituir os quatro filtros por data de pagamento por consultas que trazem `status`, `valor`, `data_vencimento`, `data_pagamento`, `descricao` e `categoria_external_id` do mês (filtro `or` por pagamento no período ou vencimento no período, igual ao usado em `ContaAzulDashboard`), agregando no cliente.
- Reutilizar `isTransferencia` de `@/lib/conta-azul/dre` para excluir transferências, com o mapa de nomes vindo de `ca_plano_contas`.
