## Problema

Em `src/components/KanbanFilters.tsx`, ao clicar em "+ Filtro" e escolher um campo, o filtro é adicionado ao estado com valores vazios (ex.: `{ type: "multi", values: [] }`). Porém a lista de chips renderizados usa `activeEntries`, que filtra por `isActive(v)` — e um filtro recém-criado ainda não é "ativo". Resultado: nenhum chip aparece, nenhum popover de edição abre, e o usuário não tem onde digitar/selecionar os valores.

## Correção

Ajustar `KanbanFilters.tsx` para que filtros pendentes de preenchimento também apareçam como chip editável:

1. Renderizar chips a partir de **todas** as entradas de `value` (não só as ativas), mantendo a ordem de inserção.
2. No resumo do chip (`summarize`), mostrar "Selecionar…" (multi), "Definir período…" (date-range) ou "Definir intervalo…" (number-range) quando o filtro ainda não tem valores.
3. Abrir o popover de edição automaticamente para o filtro recém-criado — já é feito via `setEditingKey(f.key)` em `startField`, mas só funcionará depois de (1).
4. Em `applyKanbanFilters`, continuar ignorando filtros inativos (comportamento atual já correto — nenhum efeito no resultado até o usuário preencher).
5. O botão "Limpar" continua aparecendo quando há qualquer entrada (ativa ou pendente), para permitir descartar um filtro pendente sem valores.

Sem mudanças em `compras.index.tsx`, `financeiro.index.tsx`, schema, ou lógica de negócio.
