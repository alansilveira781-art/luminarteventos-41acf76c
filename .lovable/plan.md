## 1) Estoque › Devoluções — botão "Imprimir formulário" não abre

**Diagnóstico**
O botão já existe em `src/components/patrimonio/Devolucoes.tsx`, mas a função `imprimirFormularioDevolucao` chama `window.open("", "_blank", …)`. No preview e em várias configurações de navegador esse pop-up é bloqueado (o toast "Bloqueio de pop-up…" aparece ou nada acontece), então o formulário nunca abre.

**Correção**
Trocar a estratégia por um **iframe oculto** injetado no próprio documento:

1. Cria `<iframe style="display:none">`, escreve o mesmo HTML (cabeçalho REQ, tabela de conferência, campos Físico/Condição, assinaturas).
2. Aguarda `onload`, chama `iframe.contentWindow.focus() + print()`.
3. Remove o iframe após o `afterprint` (ou depois de ~1s de fallback).
4. Mantém o pop-up como fallback apenas se o iframe falhar.

Assim funciona sem depender de permissão de pop-up e mantém o layout já pronto (cabeçalho, tabela Item/Especificação/Saída/Já dev./Saldo/UN/Sistema/Físico/Condição, observações e linhas de assinatura).

---

## 2) Módulo Compras — cards do Natanael voltam ao status original

**Diagnóstico (banco)**
Configuração atual de `compras_status_defaults`:

```text
solicitacao         → Natanael
analise             → Natanael
pendente_aprovacao  → Maicon Viana
aprovada            → Natanael
em_andamento        → Natanael
a_receber           → Natanael
finalizado          → Natanael
```

Natanael **não** é admin do módulo compras (`is_admin=false`).

A trigger `validate_compra_status_transition` exige que o usuário seja responsável **tanto pelo status de origem quanto pelo de destino**. Quando Maicon aprova e o card fica em `pendente_aprovacao`, o Natanael tenta puxar para `aprovada` — o destino é dele (passa), mas a origem é do Maicon (bloqueia). A UI faz update otimista → o banco rejeita → o `onError` reverte e invalida a query → **o card volta ao status anterior no refresh**. Esse é exatamente o sintoma descrito.

**Correção (regra pretendida)**
Quem "puxa" um card é o responsável pelo **status de destino**. O responsável do status de origem não precisa autorizar a saída — do contrário todo card que passa por Maicon fica preso lá.

Ajustes:

- **Banco** (`validate_compra_status_transition`, migração): manter só o check do destino. Admin/module-admin continuam liberados. Se o destino tem responsável configurado, apenas ele (ou admin) pode mover para lá. Remover o bloco que compara `auth.uid()` com o responsável de ORIGEM.
- **Front** (`src/lib/compras.ts` → `canMoveCompra`): remover a mesma regra "origem exige responsável de origem" para que a UI habilite o arraste/avanço coerentemente e não mostre erro antes de tentar.
- **Front** (`src/routes/compras.index.tsx`): remover as mensagens "Apenas X pode retirar o card de…" (a mensagem restante — "Apenas Y pode mover o card para…" — continua cobrindo o único caso que ainda é bloqueado).
- **Pedro** continua com a whitelist atual (Solicitação → Análise → Pendente Aprovação), sem alterações.

Resultado: Natanael consegue puxar cards de `pendente_aprovacao` (Maicon) para `aprovada` (dele) e o movimento persiste após refresh; Maicon continua sendo o único (fora admin) que pode enviar para `pendente_aprovacao`.

---

## Arquivos afetados

- `src/components/patrimonio/Devolucoes.tsx` — substituir `imprimirFormularioDevolucao` (window.open → iframe).
- `supabase/migrations/*` — nova migração ajustando `validate_compra_status_transition`.
- `src/lib/compras.ts` — remover check de responsável de origem em `canMoveCompra`.
- `src/routes/compras.index.tsx` — simplificar as mensagens de erro de movimentação.
