## Objetivo
Remover todo tratamento especial do usuário Natanael no módulo Compras. Ele passa a seguir as mesmas regras de qualquer usuário (responsáveis por status). A regra do Pedro permanece intacta.

## Mudanças

### 1. `src/lib/compras.ts`
- Remover constantes `NATANAEL_USER_ID` e `NATANAEL_NOME`.
- Remover funções auxiliares `isNatanaelSolicitante` e `isNatanaelComprador`.
- Remover a função exportada `canNatanaelMoveTo` inteira.
- Em `canEditCompra`, remover apenas a linha `if (userId && userId === NATANAEL_USER_ID) return true;` — resto permanece igual.
- **Não tocar** em `canMoveCompra`, `PEDRO_*` ou qualquer lógica do Pedro.

### 2. `src/routes/compras.index.tsx`
- Remover `canNatanaelMoveTo` do import de `@/lib/compras`.
- Em `advanceToStatus`, remover as duas linhas:
  ```
  // Regra silenciosa do Natanael (sem notificação/toast)
  if (!canNatanaelMoveTo(compra, user?.id, isAdmin, status)) return;
  ```

## Banco (RLS)
Verifiquei as migrations: a migration `20260624171008` já substituiu as políticas antigas de UPDATE/DELETE em `compras`, removendo os UUIDs hardcoded (incluindo o do Natanael). As políticas atuais usam apenas `created_by`, `is_admin` e `is_module_admin('compras')`. **Nenhuma alteração no banco é necessária.** A migration antiga `20260624144423` que continha o UUID é histórica e não deve ser editada.

## Verificação final
Após as edições, buscar `NATANAEL`, `canNatanaelMoveTo` e `fd75a882-75fe-4e5b-935b-d650f050d6be` em `src/` para confirmar que não sobrou nenhuma referência órfã, e rodar typecheck.
