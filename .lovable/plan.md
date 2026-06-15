## Objetivo

Adicionar fluxo de "avançar status" no quadro de compras e tratar especificamente a aprovação no status **Pendente Aprovação**.

## 1. Botão "Avançar" no card do kanban

Em `src/routes/compras.index.tsx`, no componente `Card`:
- Adicionar um pequeno botão (ícone `ChevronRight`) ao lado do código `COMPRA-xx`.
- Só aparece se existir um próximo status (não aparece em `finalizado` nem `negada`).
- Ao clicar, dispara a mesma rotina do `onDragEnd` movendo para o próximo status (`COMPRA_STATUSES[idx+1]`), reaproveitando `statusDefaults` + `setPendingMove` + `notifyResponsavel`.

## 2. Botão "Avançar para X" no `CompraDialog`

Em `src/components/CompraDialog.tsx`:
- No rodapé do dialog, adicionar botão `Avançar para "{próximo status}"` (esquerda dos botões existentes).
- Se status atual = `pendente_aprovacao`, esse botão é substituído por **"Aprovar compra"** (verde) — ver item 3.
- Não aparece nos status terminais.
- Mesmo handler do item 1: respeita responsável padrão, senão abre `AvancarCardDialog`.

## 3. Aprovação em "Pendente Aprovação"

Regras:
- O botão **"Aprovar compra"** aparece dentro do `CompraDialog` quando `status === 'pendente_aprovacao'`.
- Só é visível se o usuário logado for:
  - O `responsavel_id` atual do card, **ou**
  - Admin do módulo compras (`is_module_admin('compras')` / `useAuth().isAdmin`).
- Ao clicar:
  - Atualiza `status` para `aprovada`.
  - Se houver `compras_status_defaults` para `aprovada`, aplica esse responsável e o notifica.
  - Senão, aplica o usuário logado como responsável (sem abrir dialog adicional, pois "aprovou" é ação explícita).
  - Toast: "Compra aprovada. {Próximo responsável} foi notificado."

Como o Maicon é o `responsavel_id` em `pendente_aprovacao` (via `compras_status_defaults`), ele verá o botão e poderá aprovar com 1 clique.

## 4. Refatoração leve

Extrair a lógica de "avançar status" hoje dentro de `onDragEnd` para uma função `advanceToStatus(compra, targetStatus)` no mesmo arquivo, reutilizada por:
- `onDragEnd`
- Botão de avançar no card
- Botão de avançar no dialog
- Botão "Aprovar compra" (chama `advanceToStatus(compra, 'aprovada')` com bypass do dialog)

## Fora de escopo
- Não altera lógica de notificações já existente.
- Não cria papel/permissão nova: usa o `responsavel_id` do card + admin do módulo.
- Não muda demais módulos (demandas, comercial).

## Arquivos afetados
- `src/routes/compras.index.tsx` — botão no card + função `advanceToStatus`.
- `src/components/CompraDialog.tsx` — botões "Avançar" e "Aprovar compra" no rodapé.
