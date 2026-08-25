# Corrigir Recebido e Pago pelo mês da baixa

## Objetivo

Fazer os cards **Recebido no mês** e **Pago no mês** refletirem tudo o que foi efetivamente liquidado no período selecionado, independentemente do mês de vencimento do título.

## Diagnóstico confirmado

- A função compartilhada dos indicadores atualmente soma títulos pagos pela `data_vencimento`, por isso agosto mostra apenas R$ 943.298,87 no Painel.
- Na base atual, agosto de 2026 possui **zero** registros com `data_pagamento` preenchida tanto em contas a receber quanto em contas a pagar.
- O sincronismo já consulta o detalhe das parcelas e reconhece `baixas[]`, mas consolida as liquidações em apenas uma data e um valor no lançamento principal. Isso não representa corretamente pagamentos parciais ou múltiplas baixas em meses diferentes.
- O reprocessamento por período também seleciona candidatos pelo vencimento; assim, uma baixa de agosto de um título vencido em julho pode ficar fora da reconciliação.

## Implementação

1. **Persistir as liquidações individualmente**
   - Criar uma tabela de baixas financeiras vinculada ao `external_id` do lançamento, distinguindo contas a receber e a pagar.
   - Armazenar identificador da baixa quando fornecido, data efetiva, valor líquido realizado e data de sincronização.
   - Aplicar grants, RLS e políticas equivalentes às tabelas financeiras existentes.

2. **Corrigir o sincronismo**
   - Extrair todos os itens de `baixas[]` retornados pelo detalhe da parcela, sem consolidá-los na data mais recente.
   - Tratar recebimentos/pagamentos parciais e múltiplas liquidações sem duplicar valores em novas sincronizações.
   - Ampliar a reconciliação para localizar títulos alterados e baixas do período mesmo quando o vencimento pertence a outro mês.
   - Manter os campos consolidados do lançamento principal para compatibilidade com o DRE e telas existentes.

3. **Alterar os indicadores compartilhados**
   - **Recebido no mês:** soma das baixas de contas a receber cuja data efetiva cai no período.
   - **Pago no mês:** soma das baixas de contas a pagar cuja data efetiva cai no período.
   - Excluir transferências entre contas, preservando a regra atual.
   - Manter **A receber** e **A pagar** pela competência/vencimento e saldo pendente.
   - Usar a mesma fonte no Painel e no Dashboard Financeiro para evitar divergências.

4. **Reprocessar e validar agosto de 2026**
   - Reconciliar contas a receber e a pagar em uma janela ampla de vencimentos, persistindo as baixas ocorridas em agosto.
   - Comparar os totais com o Conta Azul e listar qualquer diferença residual por lançamento.
   - Confirmar também títulos vencidos antes/depois de agosto, pagamentos parciais e exclusão de transferências.

## Detalhes técnicos

- Principais arquivos: sincronismo do Conta Azul, biblioteca compartilhada de indicadores, Painel e Dashboard Financeiro.
- A consulta visual será filtrada por `data_baixa`, não por `data_vencimento`.
- A migração incluirá índices por `(tipo, data_baixa)` e por lançamento para manter os cards rápidos.
