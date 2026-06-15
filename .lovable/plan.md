## Objetivo

Restringir movimentação de cards no quadro de Compras ao **responsável atual do card**, com exceções para admins e cards sem responsável.

## Regra de permissão (`canMoveCard`)

Usuário pode mover/avançar/aprovar um card se **qualquer uma** for verdadeira:
1. `compra.responsavel_id === user.id`
2. `compra.responsavel_id` é nulo/vazio (card sem responsável → liberado para qualquer um com acesso ao módulo compras)
3. `isModuleAdmin('compras')` (admin global ou admin do módulo)

Helper único em `src/lib/compras.ts` (ou no topo de `compras.index.tsx`):
```ts
canMoveCard(compra, userId, isAdmin): boolean
```

## 1. `src/routes/compras.index.tsx`

- Buscar `responsavel_id` no SELECT da query `compras` (hoje só pega responsavel_nome implicitamente — confirmar e adicionar).
- Importar `useAuth` para obter `user.id` e `isModuleAdmin('compras')`.
- Aplicar `canMoveCard` em três pontos:

### a) Drag and drop
- No `Card`, passar `disabled` para `useDraggable({ id, disabled: !canMove })`.
- Sem isso, o usuário ainda consegue arrastar — bloquear no `useDraggable` é a forma correta.
- Em `onDragEnd`, redundância: rejeitar com `toast.error("Apenas o responsável pode mover este card.")` se `!canMove`.

### b) Botão ChevronRight no card
- Renderizar sempre, mas com `disabled` + `title` quando `!canMove`: "Apenas {responsavel_nome} pode avançar este card".
- Visual: opacity reduzida e cursor not-allowed.

### c) Diálogo `AvancarCardDialog`
- Não muda — só abre se o avanço foi iniciado por quem pode.

## 2. `src/components/CompraDialog.tsx`

- Receber `responsavel_id` e `responsavel_nome` no `form` (já estão no type).
- Calcular `canMove` localmente com `useAuth`.
- Botão **"Avançar para X"**: sempre renderizado, `disabled` quando `!canMove`, com `title` explicando.
- Botão **"Aprovar compra"**: mesma regra (substitui a condição atual de "responsavel OR admin" pela `canMove` unificada — efeito é equivalente, mas consistente).
- Adicionar pequeno texto/badge no header do dialog quando há responsável: "Responsável: {nome}".

## 3. Mensagem do tooltip

Helper `moveBlockedMessage(compra)`:
- Com responsável: `Apenas ${responsavel_nome} pode mover este card.`
- Sem responsável + sem acesso compras: `Você não tem permissão para mover este card.` (caso raro, módulo não habilitado).

## Fora de escopo
- Não muda RLS no banco (a validação é de UX/UI; o backend já permite update via RLS atual, e não há requisito de "ninguém consegue burlar via SQL").
- Não muda módulos demandas/comercial.
- Não cria papel novo "responsável por status" — segue usando `compras_status_defaults` + `responsavel_id` do card.

## Arquivos afetados
- `src/routes/compras.index.tsx` — query (`responsavel_id`), `canMoveCard`, `useDraggable({ disabled })`, botão do card, guarda em `onDragEnd`.
- `src/components/CompraDialog.tsx` — `canMove` no rodapé, badge de responsável no header.
