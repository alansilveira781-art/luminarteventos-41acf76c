## Objetivo

Corrigir o fluxo de aprovação em Compras: (1) validar permissão dentro de `advanceToStatus` (botões Avançar/Aprovar/Reprovar), (2) só notificar após confirmação real do banco, (3) reforçar a regra no banco via trigger.

## Alterações

### 1. `src/routes/compras.index.tsx`

**1a. Validação no início de `advanceToStatus`**
Adicionar bloco `canMoveCompra(...)` logo após o guard `compra.status === status`, replicando exatamente a mesma mensagem de erro usada no `onDragEnd` (Pedro / responsável configurado / fallback).

**1b. Notificação só após confirmação**
Trocar `moveStatus.mutate(...)` por `await moveStatus.mutateAsync(...)` dentro de `try/catch` nos dois caminhos de `isAdvance`:
- caminho com responsável configurado: notifica e mostra toast só após o await
- caminho `opts.force`: toast só após await
- em caso de erro: `return` (o `onError` da mutation já reverte e mostra toast)

**1c. Melhorar `onError` da mutation `moveStatus`**
Adicionar `qc.invalidateQueries({ queryKey: ["compras"] })` e trocar a mensagem para "Você não tem permissão para mover este card, ou a ação foi bloqueada."

### 2. Migration SQL (reforço no banco)

Criar função `public.validate_compra_status_transition()` (SECURITY DEFINER) e trigger `BEFORE UPDATE` em `public.compras`:
- Só age quando `NEW.status IS DISTINCT FROM OLD.status`
- Admin ou module_admin de compras → passa direto
- Senão, lê `responsavel_id` em `compras_status_defaults` para o status de destino
- Se há responsável definido e `auth.uid()` não é ele → `RAISE EXCEPTION` com `insufficient_privilege`

Complementa a RLS existente sem alterá-la. Não afeta o Pedro enquanto os status `analise`/`pendente_aprovacao` não tiverem responsável configurado.

## Não fazer

- Não mexer em `canMoveCompra`, `canEditCompra`, `PEDRO_*` ou `notifyResponsavel`
- Não remover o optimistic update (`onMutate`)
- Não alterar a policy RLS `compras_update_owner_or_admin`
- Não alterar outros módulos
