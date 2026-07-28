## Objetivo
Permitir selecionar vários itens no filtro "Item" da aba Estoque › Relatórios, para gerar relatórios (incluindo Posição de estoque) apenas com os itens escolhidos.

## Alterações em `src/routes/relatorios.tsx`

1. **Estado do filtro**
   - Trocar `itemId: string` por `itemIds: string[]` (vazio = todos os itens).
   - Incluir `itemIds` na `queryKey` do relatório (ordenado/serializado para estabilidade do cache).

2. **Controle de seleção múltipla**
   - Substituir o `Select` atual por um `Popover` + `Command` (padrão já usado em outros comboboxes do projeto) com:
     - campo de busca por nome/código (mantendo o comportamento atual);
     - lista com checkbox por item;
     - opção "Todos os itens" para limpar a seleção;
     - botão "Limpar seleção".
   - No gatilho, mostrar: "Todos os itens", o nome do item quando houver apenas 1, ou "N itens selecionados".
   - Abaixo do campo, exibir os itens escolhidos como badges removíveis (limitando a exibição a ~6 com "+N").

3. **Consulta (`loadReport`)**
   - Trocar o parâmetro `itemId` por `itemIds: string[]`.
   - Onde hoje há `.eq("item_id", filtroItem)` → usar `.in("item_id", itemIds)` quando houver seleção.
   - Onde hoje há `.eq("id", filtroItem)` (relatórios `estoque` e `estoque_negativo`) → usar `.in("id", itemIds)`.
   - Sem seleção, comportamento atual (todos) é mantido.

4. **Exportações**
   - CSV e PDF continuam usando os dados já filtrados; sem mudanças de lógica.
   - No cabeçalho do PDF e no subtítulo do card, acrescentar "N itens selecionados" quando houver filtro ativo, para o relatório impresso ficar autoexplicativo.

## Observações técnicas
- Nenhuma mudança de banco de dados ou de regras de acesso.
- Se a seleção ficar muito grande, o `.in()` continua funcionando; o limite de 5000 registros por consulta permanece o mesmo de hoje.