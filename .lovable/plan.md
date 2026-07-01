## Objetivo

Restringir a movimentação de cards de Compras: quando o status de destino tem responsável definido em Configurações, apenas esse responsável (ou admin) pode mover o card para lá. Regra do Pedro permanece intacta.

## Alterações

### 1. `src/lib/compras.ts`
Adicionar parâmetro opcional `statusResponsavelId` em `canMoveCompra`. Depois do bloco do Pedro:
- Admin → sempre permite.
- Se `targetStatus` tem `statusResponsavelId` → apenas o próprio responsável.
- Caso contrário → fallback para `canEditCompra` (comportamento atual).

`canEditCompra` fica intacta.

### 2. `src/routes/compras.index.tsx`
- Criar helper `responsavelDoStatus(status)` a partir de `statusDefaults`.
- No `onDragEnd`: passar `responsavelDoStatus(status)` para `canMoveCompra` e melhorar a mensagem de toast citando o nome do responsável definido.
- No render dos cards: passar `responsavelDoStatus(next)` na checagem que habilita o botão "Avançar".

### 3. `src/components/CompraDialog.tsx`
- Garantir a query `compras_status_defaults` (reaproveitar se já existir com a mesma queryKey).
- Nos botões "Aprovar/Reprovar" de `pendente_aprovacao`: buscar responsável configurado para `aprovada` e `negada` e passar como `statusResponsavelId` nas duas chamadas de `canMoveCompra`.

## Não fazer
- Não mexer na lógica do Pedro, em `canEditCompra`, em `notifyResponsavel`, no `AvancarCardDialog` ou em outros módulos.
- Sem alteração de banco/RLS nesta rodada (o prompt oferece reforço server-side apenas se solicitado).
