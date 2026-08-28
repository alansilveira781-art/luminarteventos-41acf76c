# Exclusão de item do estoque com saída de baixa

## Problema

Hoje, ao clicar em excluir um item na tela de Estoque, o sistema tenta apagar as movimentações e depois o item. Quando alguma movimentação não é removida (regras de acesso), o banco recusa a exclusão com a mensagem:

"update or delete on table itens violates foreign key constraint movimentacoes_item_id_fkey"

Confirmado no banco: `movimentacoes` e `movimentacao_itens` apontam para `itens` com regra RESTRICT, ou seja, o item só pode sair depois que essas linhas saírem.

## O que será feito

1. Ao clicar no ícone de excluir, abrir uma confirmação clara: informa o nome do item, o saldo atual, e avisa que será lançada uma saída de baixa zerando o item e, em seguida, o item será excluído junto com seu histórico. Botão "Excluir item" só age após confirmação.
2. A exclusão passa a ser feita em uma única operação no banco (atômica): se qualquer etapa falhar, nada é aplicado e o usuário recebe a mensagem de erro.
3. A operação faz, nesta ordem:
   - registra uma movimentação de saída com a quantidade atual (motivo: baixa por exclusão de item), zerando o saldo;
   - remove as referências do item em itens de solicitação de saída e em itens de aquisição/demanda (desvinculando, sem apagar as solicitações);
   - remove as movimentações do item;
   - exclui o item.
4. Mesma exclusão em massa (botão "Excluir selecionadas") passa a usar o mesmo caminho, com a mesma confirmação.

## Detalhes técnicos

- Nova função de banco `public.estoque_excluir_item(p_item_id uuid)` com `SECURITY DEFINER` e `search_path = public`, executável apenas por quem é admin do módulo estoque (`is_module_admin(auth.uid(), 'estoque')`), retornando erro caso contrário.
- Dentro dela: insert em `movimentacoes` (tipo saída, quantidade = saldo atual) para deixar o registro do lançamento; depois `update` de `estoque_solicitacoes_saida_itens.item_id`/`demanda_itens.item_id` para null; `delete` em `movimentacao_itens` e `movimentacoes`; `delete` em `itens`.
- `GRANT EXECUTE` para `authenticated`.
- Em `src/routes/estoque.index.tsx`: `delMut` e `bulkDelMut` chamam `supabase.rpc("estoque_excluir_item", ...)` em vez dos deletes diretos; confirmação via diálogo (AlertDialog) no lugar do `confirm()` atual, com o texto descrito acima.
- Nenhuma outra tela, regra ou comportamento será alterado.
