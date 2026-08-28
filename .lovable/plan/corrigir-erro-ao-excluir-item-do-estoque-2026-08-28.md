# Corrigir erro ao excluir item do estoque

## Causa confirmada

O erro `new row for relation "itens" violates check constraint "chk_itens_quantidade_nao_negativa"` não vem de política de acesso, e sim de um gatilho do banco.

Verificado no banco:

- A tabela `itens` tem a regra `quantidade_atual >= 0`.
- Existe o gatilho `trg_revert_movement_on_delete` em `movimentacoes`: sempre que uma movimentação é apagada, ele **estorna** o efeito dela no saldo do item (apagar uma entrada de 10 subtrai 10 do saldo).

Na exclusão do item, a operação primeiro lança a saída de baixa (saldo vai a 0) e depois apaga todo o histórico de movimentações. Ao apagar as entradas antigas, o gatilho tenta subtrair essas quantidades de um saldo já zerado, jogando o saldo para negativo e batendo na regra de não-negatividade.

## O que será feito

Ajustar a operação de exclusão para que o estorno automático não seja aplicado quando o item inteiro está sendo excluído — afinal, o item deixa de existir e o saldo não precisa ser recalculado.

1. O gatilho de estorno passa a respeitar um sinalizador de "exclusão de item em andamento": quando ativo, ele não mexe no saldo.
2. A função de exclusão liga esse sinalizador durante a sua execução (apenas dentro da própria transação) e segue o mesmo fluxo já aprovado: lança a saída de baixa zerando o item, desvincula referências, apaga movimentações e exclui o item.
3. Resultado: a exclusão conclui sem erro, mesmo em itens com muitas entradas ou com saldo já zerado/negativo.

## Detalhes técnicos

- `public.revert_movement_on_delete()`: adicionar no início `IF current_setting('app.excluindo_item', true) = 'on' THEN RETURN OLD; END IF;` (restante inalterado).
- `public.estoque_excluir_item(uuid)`: executar `PERFORM set_config('app.excluindo_item', 'on', true)` antes dos deletes e `set_config(..., 'off', true)` ao final — `true` limita o efeito à transação corrente, sem afetar outras operações.
- Tratar também saldo negativo: a saída de baixa continua sendo lançada apenas quando o saldo é maior que zero; itens com saldo negativo são apenas excluídos.
- Nenhuma alteração de interface e nenhuma outra política ou tabela será tocada.
