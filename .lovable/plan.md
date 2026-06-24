## Objetivo

Ajustar as permissões do Pedro no módulo Compras:

- **Editar**: pode editar qualquer informação do card em qualquer status (já está assim, vou apenas confirmar).
- **Mover**: pode mover apenas nestes dois sentidos:
  - `Solicitação de Compra` → `Análise de Compra`
  - `Análise de Compra` → `Pendente Aprovação`
- Qualquer outro movimento (voltar status, pular etapas, mover depois de Pendente Aprovação) fica bloqueado com mensagem.

## Mudanças

### 1. `src/lib/compras.ts`
Reescrever `canMoveCompra` para o Pedro validar o par (status atual → status alvo), não apenas o alvo:

- Aceita também o `currentStatus` como parâmetro.
- Para Pedro, só permite os pares exatos:
  - `solicitacao → analise`
  - `analise → pendente_aprovacao`
- Demais usuários: comportamento atual (delega para `canEditCompra`).
- `canEditCompra` continua retornando `true` para Pedro em qualquer status.

Atualizar a assinatura para receber `currentStatus` (opcional) — quando não informado (ex.: cálculo de "pode arrastar em geral"), libera o Pedro para os status de origem permitidos (`solicitacao` ou `analise`).

Adicionar helper `pedroMoveBlockedMessage()` com texto explicativo: "Pedro só pode mover de Solicitação → Análise e de Análise → Pendente Aprovação."

### 2. `src/routes/compras.index.tsx`
- Passar `compra.status` (status atual) para `canMoveCompra` no `onDragEnd` e ao calcular `canMove` por card.
- Quando o movimento for bloqueado especificamente para o Pedro, exibir a mensagem específica via `toast.error`.

Nenhuma mudança em banco/RLS — Pedro já tem `UPDATE` liberado pela policy aplicada anteriormente; a restrição de quais movimentos são permitidos fica no frontend (consistente com a lógica atual para outros papéis).

## Resultado esperado

- Pedro abre e edita qualquer card em qualquer coluna.
- Pedro arrasta apenas Solicitação → Análise e Análise → Pendente Aprovação.
- Tentativas de outros movimentos mostram toast explicativo e o card volta à coluna original.
