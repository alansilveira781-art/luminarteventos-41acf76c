# Corrigir percepção de "estoque zerado" após entrada

## Diagnóstico

Validei o caso citado (PAPEL HIGIENICO FOLHA SIMPLES, entrada de 64 em 09/06):
- O banco gravou: `itens.quantidade_atual = 44` (entrada +64 e depois saída −20 do mesmo dia).
- A trigger `apply_movement` está somando entradas corretamente.
- Existem 6 saídas antigas (maio) que **não deduziram** o saldo na época — foram inseridas antes da trigger estar ativa para esse item (ou via importação que bypassou triggers). Isso é histórico, não afeta entradas novas.

Conclusão: a entrada **está** atualizando `itens.quantidade_atual`. O que está errado é onde/como a tela mostra o saldo (cache desatualizado, query que ignora `quantidade_atual` ou soma manualmente as movimentações).

## Escopo (somente módulo Estoque)

1. **Auditar as telas de leitura do saldo** e garantir que todas leiam `itens.quantidade_atual` direto (fonte da verdade), e não recalculem somando `movimentacoes`:
   - `src/routes/estoque.index.tsx` (lista)
   - `src/routes/estoque.$itemId.tsx` (detalhe)
   - `src/routes/saidas.tsx` (campo "estoque disponível" no form de saída)
   - `src/routes/entradas.tsx` (mesma checagem)
   - `src/components/ItemInfoHover.tsx` e `src/components/compras/AlertaEstoqueCard.tsx`

2. **Forçar invalidação imediata** após inserir movimentação:
   - Confirmar que `useEstoqueRealtimeSync` está montado em `__root.tsx` / layout, para que a tela de Estoque receba o `UPDATE` em `itens` em tempo real.
   - Revisar as `onSuccess` das mutations de entrada/saída para invalidar também `["itens"]`, `["item", id]` e `["dashboard-itens"]` (entrada já invalida; conferir saída e devolução).
   - Garantir `staleTime: 0` nas queries críticas de saldo (form de saída).

3. **Reconciliar itens com histórico inconsistente** (one-off, opt-in):
   - Migration de um script `reconciliar_estoque(p_item_id uuid)` que recomputa `quantidade_atual` a partir do agregado de `movimentacoes` + `movimentacao_itens` aplicando as regras da trigger `apply_movement`.
   - Botão "Recalcular saldo" no detalhe do item (visível só para admin do módulo `estoque`) que chama a função.
   - **Não** rodar em massa automaticamente — usuário decide por item, para não sobrescrever ajustes manuais.

4. **Limpeza** (já aprovada):
   - Migration removendo a trigger duplicada `trg_itens_updated` em `public.itens` (mantém apenas `trg_itens_set_updated_at`, idêntica).

## Fora do escopo

- Mudar regra de devolução, compras, financeiro, ou qualquer outro módulo.
- Backfill automático em massa de saldos (histórico ficaria como está, exceto onde o usuário clicar em "Recalcular saldo").

## Validação após implementar

- Cadastrar uma entrada nova de teste e conferir que o card do item, o detalhe e o "estoque disponível" no form de saída sobem **sem precisar atualizar a página**.
- Clicar "Recalcular saldo" no PAPEL HIGIENICO e confirmar que o saldo passa a refletir o histórico (ou continuar 44, caso o usuário confirme que as 6 saídas antigas não devem deduzir).
- `SELECT * FROM pg_trigger WHERE tgrelid='public.itens'::regclass` mostra apenas uma trigger de `updated_at`.
