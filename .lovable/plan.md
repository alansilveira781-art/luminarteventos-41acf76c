## Diagnóstico

**Compras — regra que está travando o Natanael**

`canEditCompra` em `src/lib/compras.ts` só libera edição quando o usuário é:
- admin global / módulo-admin;
- `responsavel_id` do card;
- `created_by` do card;
- ou o card não tem responsável nem criador.

O Natanael é o responsável padrão dos status `solicitacao`, `analise`, `aprovada`, `em_andamento` e `finalizado` (confirmado em `compras_status_defaults`). Enquanto o card fica com `responsavel_id = Natanael`, tudo funciona. Mas assim que alguém (admin) reatribui o card manualmente, ou o card foi criado antes das configurações atuais e passou por `em_andamento` sem passar pela RPC `move_compra_status` que sobrescreve o responsável, o `responsavel_id` fica diferente de Natanael e ele perde a permissão de editar — mesmo sendo o responsável configurado do status em que o card está.

O `canDeleteCompra` já considera esse caso (aceita o `statusResponsavelId`), mas o `canEditCompra` (usado para habilitar o botão "Salvar", o select de Status e todo o formulário no `CompraDialog`) não. Também no drag-and-drop do quadro (`compras.index.tsx`) a permissão para arrastar cai no `canEditCompra` padrão quando `statusResponsavelId` e `currentStatusResponsavelId` são nulos, mas para o caso normal ele já usa a regra por responsável de status. O gargalo é só a edição do card em si.

RLS no banco já permite: a policy `compras_update_owner_or_admin` inclui `auth.uid() IN (select responsavel_id from compras_status_defaults where status = compras.status)` — ou seja, o servidor deixa o Natanael salvar; é o front que bloqueia o botão.

**Despesas — verificação**

Em `DemandaDialog` não existe gate client-side de edição — qualquer usuário com acesso ao módulo Financeiro consegue editar (o botão "Salvar" não é desabilitado). A RLS da tabela `demandas` também libera tudo para quem tem `has_module_access('financeiro')`. Ou seja, o Natanael consegue editar despesas normalmente; o problema relatado é específico do módulo Compras.

## Mudanças

### 1. `src/lib/compras.ts`
Estender `canEditCompra` para aceitar o `statusResponsavelId` (responsável configurado do status atual do card) e retornar `true` quando `userId === statusResponsavelId`, seguindo a mesma regra que `canDeleteCompra` já usa.

Assinatura nova:
```ts
canEditCompra(compra, userId, isAdmin, userEmail, statusResponsavelId?)
```
- Se `statusResponsavelId` for informado e `userId` for igual a ele → `true`.
- Todo o resto do comportamento permanece igual (admin, Pedro, responsável, criador, cards órfãos).

### 2. `src/components/CompraDialog.tsx`
Passar o `statusResponsavelId` para o `canEditCompra`, usando o mesmo `responsavelDoStatus(statusInicial)` que já é calculado (`statusRespIdPersistido`). Assim o cálculo do `canEdit` fica:

```ts
const canEdit =
  !compraId ||
  canEditCompra(form as any, user?.id, isAdmin, user?.email, statusRespIdPersistido);
```

Isso libera o botão Salvar, o select de Status e demais controles do formulário para o responsável do status atual, cobrindo o cenário do Natanael em `em_andamento` mesmo quando o `responsavel_id` do card estiver diferente.

### 3. `src/routes/compras.index.tsx`
Nenhuma alteração adicional: o `canMoveCompra` já considera `statusResponsavelId`/`currentStatusResponsavelId` no arrastar, então mover cards continua funcionando. Apenas edição inline (abrir → salvar) muda.

### 4. Despesas
Nenhuma mudança de código. Confirmar em conversa que o problema é apenas em Compras. Se o usuário também quiser restringir/expandir a edição de despesas por responsável de status (hoje qualquer um do módulo Financeiro edita), isso é uma outra decisão.

## Verificação após implementar

1. Como Natanael, abrir um card em "Compra Em Andamento" cujo `responsavel_id` esteja em branco ou aponte para outra pessoa — o botão "Salvar" e os campos devem ficar habilitados.
2. Como um usuário sem vínculo (nem responsável do card, nem do status, nem admin), abrir o mesmo card — botão Salvar continua desabilitado, com o tooltip explicando o bloqueio.
3. Editar um campo (ex.: título) e salvar; a RLS do banco já aceita.
4. Confirmar que Despesas segue funcionando como antes (sem alterações).
