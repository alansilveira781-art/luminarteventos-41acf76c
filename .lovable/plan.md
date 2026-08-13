# Corrigir anexos que "vazam" de um card para outro

## O problema (confirmado no código)

Nos cards de Compras e de Despesas, os arquivos escolhidos antes de salvar ficam guardados em duas listas separadas: anexos e comprovantes.

Ao abrir o diálogo (novo card ou outro card) e ao salvar com sucesso, apenas a lista de **anexos** é esvaziada. A lista de **comprovantes** permanece na memória.

Consequência: ao abrir um novo card logo depois de mexer em outro, os comprovantes do card anterior aparecem já selecionados — e, se o usuário salvar, são enviados para o card errado.

## Correção

Em `src/components/CompraDialog.tsx` e `src/components/DemandaDialog.tsx`:

1. Ao abrir o diálogo, limpar também a lista de comprovantes pendentes (junto com os anexos pendentes, tanto para card novo quanto ao carregar um card existente).
2. Após salvar com sucesso, limpar as duas listas.
3. Como reforço, limpar as duas listas quando o diálogo é fechado, para não deixar resíduo entre aberturas.

Nenhuma mudança de banco de dados, permissões ou regras de negócio.

## Verificação

- Anexar um comprovante em um card, fechar sem salvar, abrir um card novo: a aba de anexos/comprovantes deve estar vazia.
- Salvar um card com comprovante e abrir outro em seguida: nada deve vir pré-carregado.
- Anexos já salvos no banco continuam aparecendo normalmente no card correto.
