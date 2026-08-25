# Igualar Recebidos e Pagos ao Conta Azul

## Objetivo

Fazer os indicadores de agosto de 2026 exibirem os valores efetivos do Conta Azul:

- **Recebidos:** R$ 1.191.796,68
- **Pagos:** R$ 1.063.421,97

Os valores serão apurados pela data real de cada baixa, independentemente do vencimento do lançamento.

## Diagnóstico confirmado

- A tabela de baixas contém atualmente apenas **R$ 998.880,73 recebidos** e **R$ 204.174,42 pagos** em agosto.
- Existem **244 contas pagas já marcadas como detalhadas, mas sem baixa persistida**.
- Uma sincronização recente registrou interrupção por limite de execução e deixou **470 recebimentos sem enriquecimento de detalhe**.
- O cache atual pode pular lançamentos já detalhados antes da criação da tabela de baixas; nesse caso, o sincronismo não volta a consultar o detalhe nem preenche as liquidações ausentes.
- Portanto, os cards estão somando corretamente o que existe na tabela de baixas, mas essa tabela ainda não representa todas as liquidações do período.

## Implementação

1. **Corrigir o critério do cache de detalhes**
   - Só considerar um lançamento liquidado como completamente enriquecido quando suas baixas também estiverem persistidas.
   - Reconsultar automaticamente lançamentos pagos que tenham `data_pagamento`, mas não tenham registros na tabela de baixas.

2. **Criar reprocessamento seguro de liquidações**
   - Processar contas a pagar e receber em lotes pequenos, com checkpoints, evitando perder centenas de registros por limite de execução.
   - Buscar uma janela ampla de vencimentos para capturar baixas de agosto pertencentes a títulos vencidos em outros meses.
   - Persistir todas as baixas individuais de cada parcela sem duplicidade.

3. **Reconciliar valor bruto, líquido e exclusões**
   - Comparar cada baixa retornada pela API com o total mostrado no Conta Azul.
   - Aplicar a mesma base usada pelos cards de “Recebidos” e “Pagos” do Conta Azul, incluindo juros, multas, descontos e taxas conforme a composição retornada.
   - Identificar separadamente transferências ou ajustes excluídos pelo Conta Azul, sem descartá-los apenas por uma classificação incompleta no cadastro local.

4. **Reprocessar e validar agosto de 2026**
   - Preencher as baixas históricas ausentes de contas a receber e a pagar.
   - Gerar uma conferência por dia e por lançamento até fechar exatamente **R$ 1.191.796,68** e **R$ 1.063.421,97**, ou apontar objetivamente cada diferença ainda devolvida pela API.
   - Confirmar os mesmos totais no Painel e no Dashboard Financeiro.

## Detalhes técnicos

- Manter os cards baseados em `ca_lancamento_baixas.data_baixa`.
- Ajustar o sincronismo em `src/lib/conta-azul/sync.server.ts` para não tratar `detalhe_synced_at` como suficiente quando faltarem baixas.
- Usar processamento retomável em vez de uma única execução longa.
- Preservar o DRE e os indicadores de valores em aberto sem alteração.
