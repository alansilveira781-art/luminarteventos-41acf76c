## Problema

Natanael não consegue arrastar cards no Quadro de Compras. Duas regras em `src/lib/compras.ts` o bloqueiam:

1. `canMoveCompra` → exige que ele seja `responsavel_id` ou `created_by` do card (cards criados por outros ficam travados).
2. `canNatanaelMoveTo` → silenciosamente impede que ele passe de "Pendente Aprovação" se não for solicitante E comprador.

## Solução (cirúrgica, só frontend)

Tratar o user id do Natanael (`fd75a882-75fe-4e5b-935b-d650f050d6be`, já constante em `NATANAEL_USER_ID`) como admin do módulo Compras nas funções de permissão.

### Mudanças em `src/lib/compras.ts`

- `canNatanaelMoveTo`: retornar `true` direto quando `userId === NATANAEL_USER_ID` (remove o limite até "Pendente Aprovação").
- `canEditCompra`: retornar `true` quando `userId === NATANAEL_USER_ID`, antes da checagem de responsável/criador.
- `canMoveCompra`: idem — retornar `true` para o Natanael antes de cair em `canEditCompra`.

Resultado: Natanael passa a poder editar e arrastar qualquer card entre qualquer coluna do quadro, igual a um admin. Nenhum outro usuário é afetado. As regras do Pedro e o fluxo padrão de notificações/`status_defaults` continuam intactos.

### Verificação

- Build/typecheck automático.
- Conferir no preview, logado como Natanael, que ele arrasta um card criado por outra pessoa entre colunas, inclusive passando de "Pendente Aprovação" para "Aprovada / Em Andamento / Finalizado".

Sem migrações, sem mudanças de schema, sem alterar RLS.