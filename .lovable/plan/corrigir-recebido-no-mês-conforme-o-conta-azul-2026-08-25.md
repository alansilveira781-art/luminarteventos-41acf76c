# Corrigir “Recebido no mês” conforme o Conta Azul

## Objetivo
Fazer o Painel e o Dashboard Financeiro exibirem o mesmo valor realizado do Conta Azul para o período selecionado, incluindo os R$ 1.191.796,68 informados para agosto de 2026.

## Diagnóstico confirmado
- A base interna atualmente soma **R$ 1.158.385,73** em 59 contas recebidas com vencimento em agosto, diferença de **R$ 33.410,95** em relação ao Conta Azul.
- Os **2.908 lançamentos** de contas a receber estão com `data_pagamento` vazia.
- Por isso, Painel e Dashboard usam `data_vencimento` como substituto, o que não representa com precisão o regime de caixa.
- A sincronização atual copia apenas `data_pagamento` do payload principal; será necessário confirmar e mapear a data/valor efetivamente recebido disponibilizado no detalhe da API.

## Implementação
1. **Corrigir a sincronização de contas a receber**
   - Inspecionar o formato real retornado pela API para lançamentos recebidos.
   - Mapear corretamente a data de recebimento e o valor realizado, inclusive recebimentos parciais, juros, multas, descontos e outras diferenças quando fornecidos.
   - Preservar vencimento apenas para valores projetados, sem usá-lo como dado definitivo de caixa quando houver informação real.

2. **Reprocessar o período afetado**
   - Rodar uma sincronização completa das contas a receber de agosto de 2026.
   - Validar a quantidade e a soma dos lançamentos que compõem o recebido.
   - Conferir especificamente a diferença de R$ 33.410,95 até reconciliar o total com R$ 1.191.796,68 ou identificar lançamentos que ainda não estejam sendo retornados pela integração.

3. **Unificar a regra financeira**
   - Centralizar o cálculo de “Recebido no mês” em uma função compartilhada.
   - Usar a mesma regra no Painel e no Dashboard Financeiro: status realizado, data efetiva de recebimento e exclusão de transferências.
   - Manter “A receber” por vencimento e status em aberto.

4. **Validação**
   - Comparar Painel, Dashboard Financeiro e Conta Azul para agosto de 2026.
   - Confirmar que a navegação entre meses continua correta e que recebido, pago e saldo utilizam critérios coerentes.

## Detalhes técnicos
- Arquivos principais: sincronização do Conta Azul, biblioteca compartilhada do DRE/indicadores, Painel e Dashboard Financeiro.
- Caso a API de listagem não forneça liquidação completa, enriquecer somente os lançamentos recebidos pelo endpoint de detalhe, respeitando paginação e limites para não tornar o sincronismo lento.
