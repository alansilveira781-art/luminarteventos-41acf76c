# Busca por item nas Saídas: mostrar a requisição completa

## Problema

Na lista de Saídas, a busca (e o filtro "Filtrar por item") é aplicada linha a linha, antes de agrupar por requisição. Resultado: a requisição REQ-2104 aparece, mas só com o item pesquisado — os demais itens da mesma requisição somem, e as colunas "Itens" e "Qtd total" ficam erradas (1 / -1 em vez de 2 / -2, como na imagem 2).

## O que muda

A busca passa a identificar **requisições**, não linhas:

- Se qualquer item da requisição corresponder ao texto buscado (ou ao filtro por item), a requisição inteira aparece.
- Ao expandir, todos os itens da requisição são listados, inclusive os que não casam com a busca.
- "Itens" e "Qtd total" voltam a refletir a requisição completa.
- Filtros que são da requisição (evento, empresa, período) continuam funcionando como hoje.

Comportamento idêntico é aplicado à tela de Entradas, que usa o mesmo agrupamento por nota/requisição.

## Detalhes técnicos

- `src/routes/saidas.tsx`: remover o filtro por item/texto de `filteredBaseList` (mantendo apenas `isAjusteMovimentacao`, evento e empresa, que são atributos do grupo), montar `grupos` com todas as linhas e então filtrar os grupos: um grupo passa se `matchTokens` casar com o texto agregado do grupo (campos do grupo + todas as linhas) e, para `filterItemQd`, se **alguma** linha casar com código/nome do item.
- `src/routes/entradas.tsx`: mesmo ajuste no filtro equivalente antes do agrupamento.
- Sem mudanças de consulta ao banco, de permissões ou de outras telas.
