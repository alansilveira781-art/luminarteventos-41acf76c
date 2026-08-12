# Relatório do Financeiro — compras e despesas que não aparecem

Verifiquei os dados reais do relatório de Cartões (Financeiro Operacional › Relatórios). O relatório monta a lista a partir das formas de pagamento lançadas nos cards, e três coisas fazem lançamentos sumirem.

## Causa 1 — Formas de pagamento escritas de jeitos diferentes

O filtro busca a forma pelo texto exato. No banco existem, por exemplo, **"PIX" (55 lançamentos)** e **"Pix" (39 lançamentos)** como formas distintas — ao escolher "PIX" na lista, os 39 escritos como "Pix" ficam de fora. O mesmo vale para variações como "Cartão final 5883" x "Cartão Final ...".

## Causa 2 — Cards sem nenhuma forma de pagamento lançada

**28 compras e 18 despesas** não têm nenhuma linha de pagamento (e também estão com a condição de pagamento em branco). Como o relatório parte sempre de uma forma selecionada, esses 46 cards nunca aparecem em relatório nenhum. Há ainda 5 linhas de pagamento com a forma em branco.

## Causa 3 — Filtros de período e status

Já existe o tratamento de data alternativa (compra → solicitação → criação) e o seletor de status, mas o padrão continua "Finalizado + A receber", o que esconde cards em andamento/pendentes. Isso é esperado, só precisa ficar visível.

## O que proponho

1. **Casar formas de pagamento sem diferenciar maiúsculas/minúsculas e acentos**, para que "PIX" e "Pix" (e variações de cartão) entrem no mesmo relatório.
2. **Nova opção na lista de formas: "Sem forma informada"**, que lista justamente os cards sem pagamento lançado — assim nenhuma compra/despesa fica invisível.
3. **Opção "Todas as formas"**, gerando o relatório completo do período (com uma coluna Forma), útil para conferência geral.
4. **Aviso de conferência** abaixo da tabela já existe; deixá-lo detalhando quantos ficaram fora por período e quantos por status, para o usuário saber o que ajustar.
5. O PDF exportado passa a refletir as mesmas opções (incluindo a coluna Forma quando "Todas").

## Detalhes técnicos

- Arquivo: `src/routes/financeiro-op.relatorios.tsx`, componente `CartoesReport`.
- Lista de formas: unir `condicoes_pagamento.nome` com as formas distintas efetivamente usadas em `compra_pagamentos`/`demanda_pagamentos`, normalizando (trim + lower + sem acento) e exibindo um rótulo canônico por grupo; a query passa a buscar todas as linhas e filtrar em memória pela chave normalizada, em vez de `.eq("forma", cartao)`.
- "Sem forma informada": buscar `compras`/`demandas` cujos IDs não estão em `compra_pagamentos`/`demanda_pagamentos` (ou com `forma` nula), usando `valor_total` do card.
- "Todas as formas": agregar todas as linhas de pagamento por card e forma, acrescentando a coluna Forma na tabela e no `jspdf-autotable`.
- Contagem "fora do filtro": separar em fora do período e fora do status, calculada sobre `data?.rows`.
