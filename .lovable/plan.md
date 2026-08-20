# Corrigir edição de entradas no Estoque

## O que está acontecendo

Não é falta de permissão. O erro que aparece é do banco:
`new row for relation "itens" violates check constraint "chk_itens_quantidade_nao_negativa"`.

Hoje, editar uma entrada apaga todas as linhas antigas e depois insere as novas. Ao apagar, o sistema devolve (subtrai) a quantidade que aquela entrada tinha somado ao estoque — mesmo que parte já tenha saído. Se o saldo atual for menor que a quantidade da entrada, o estoque fica negativo por um instante e o banco bloqueia a operação inteira.

Confirmado na REQ-1927: a linha da camiseta tamanho M entrou com 25 unidades, mas o saldo atual do item é 15 (10 já saíram). 15 − 25 = −10 → bloqueio.

Ou seja: qualquer entrada cujos itens já foram parcialmente consumidos fica impossível de editar, para qualquer usuário, inclusive admin do módulo.

## Como corrigir

Trocar o "apaga tudo e recria" por uma edição inteligente, que só mexe no que mudou:

- Linhas que continuam na entrada: atualizar no lugar (item, quantidade, valores, dados do cabeçalho) e ajustar o estoque apenas pela diferença (nova quantidade − quantidade anterior). Se a quantidade não mudou, o estoque nem é tocado.
- Linhas novas: inserir normalmente (somam ao estoque).
- Linhas removidas: apagar (subtraem do estoque).

Com isso, a REQ-1927 e casos parecidos passam a ser editáveis sem erro.

Quando a alteração realmente deixaria o saldo negativo (por exemplo, reduzir de 25 para 5 quando só restam 15 em estoque), a operação continua bloqueada — o que é correto —, porém com uma mensagem clara em português dizendo qual item ficaria negativo e qual o saldo disponível, em vez do texto técnico do banco.

## Detalhes técnicos

1. Nova função no banco (`SECURITY DEFINER`), por exemplo `estoque_editar_entrada(p_requisicao, p_meta jsonb, p_linhas jsonb)`:
   - roda tudo em uma transação;
   - casa linhas antigas × novas por `id`;
   - `UPDATE` nas mantidas + aplicação do delta em `itens.quantidade_atual` (não existe trigger de UPDATE em `movimentacoes`, então o delta é aplicado explicitamente, sem risco de dupla contagem) e `refresh_item_status`;
   - `INSERT`/`DELETE` só para linhas realmente adicionadas/removidas, deixando os triggers `trg_apply_movement` / `trg_revert_movement_on_delete` agirem;
   - valida saldo antes de gravar e levanta `RAISE EXCEPTION` com mensagem amigável citando nome do item e saldo.
   - `GRANT EXECUTE` para `authenticated`, com checagem interna de acesso ao módulo estoque (mesma regra já usada nas policies de `movimentacoes`).
2. `src/routes/entradas.tsx`: `editMut` e `editGroupMut` passam a chamar a RPC em vez de `delete` + `insert`; mantidos os `invalidateQueries` atuais.
3. Sem mudanças em permissões/RLS — o problema não era de acesso.
