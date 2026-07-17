## Problema

No Quadro de Despesas (`src/routes/financeiro.index.tsx`), a validação ao mover um card para "A Receber" usa `TIPOS_QUE_VAO_PARA_ESTOQUE`, que contém apenas fardamento, material de limpeza, material de escritório e reposição de estoque. O tipo **imobilizado** está em `TIPOS_QUE_VAO_PARA_PATRIMONIO` (lista separada), então é bloqueado com a mensagem "Somente despesas de fardamento…".

A função `proximoStatusDemanda` em `src/lib/demandas.ts` já usa corretamente `TIPOS_QUE_VAO_PARA_RECEBIMENTO` (união de estoque + patrimônio), então o roteamento automático já funciona — só a guarda manual do drag/clique está errada.

## Correção

Em `src/routes/financeiro.index.tsx`, na função `advanceToStatus`:

1. Trocar o import `TIPOS_QUE_VAO_PARA_ESTOQUE` por `TIPOS_QUE_VAO_PARA_RECEBIMENTO`.
2. Trocar a checagem para permitir também imobilizado.
3. Atualizar a mensagem de erro para incluir imobilizado (algo como: "Somente despesas de fardamento, material de limpeza, material de escritório, reposição de estoque ou imobilizado podem ir para 'A Receber'.").

Nenhuma mudança em banco, tipos ou outros fluxos.
