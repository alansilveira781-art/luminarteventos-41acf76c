# Estoque no Dashboard de Compras: todos os itens + paginação

## O problema hoje

O bloco "Alerta de estoque" no Dashboard de Compras traz só itens com status "baixo estoque" ou "sem estoque" e carrega tudo de uma vez. Como existem hoje 4.882 itens cadastrados (sendo 4.020 nesses dois status), a consulta bate no limite de 1.000 linhas do backend: a lista fica incompleta e a tela pesada. O cálculo de "saídas" também varre todas as movimentações de uma vez, o que agrava a lentidão.

O acesso em si já está correto: quem tem o módulo Compras já pode ler itens e movimentações (sem precisar do módulo Estoque). Nenhuma mudança de permissão é necessária.

## O que muda

O bloco passa a se chamar **Estoque** e mostra **todos os itens**, com dados sempre atualizados:

- Filtro de status: Todos · Sem estoque · Baixo estoque · Disponível (padrão: todos os que precisam de atenção, como hoje).
- Busca por nome ou código (aplicada no banco, não só no que já foi carregado).
- Filtro por categoria.
- Ordenação: mais saídas / menos saídas / nome / menor saldo.
- **Paginação de 15 itens por página**, com contagem total ("1–15 de 4.020") e botões Anterior/Próxima.
- Resumo no topo continua mostrando quantos itens estão sem estoque e quantos em baixo estoque (via contagem no banco, não pela lista carregada).
- Botão "Solicitar" em cada linha permanece igual.

Cada troca de página, filtro ou busca busca apenas os 15 registros daquela página, deixando o dashboard bem mais rápido.

## Detalhes técnicos

- Nova função de banco `public.compras_estoque_listar(_busca, _status, _categoria, _ordem, _limite, _offset)` (SECURITY DEFINER, com checagem `has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque')`), retornando id, código, nome, categoria, unidade, quantidade atual/mínima, status, total de saídas e `total_count` — a soma de saídas é agregada em SQL (movimentações diretas + `movimentacao_itens`), eliminando a varredura no cliente.
- Função auxiliar `public.compras_estoque_resumo()` devolvendo as contagens por status para o cabeçalho.
- `src/components/compras/AlertaEstoqueCard.tsx`: substituir as duas queries atuais por uma `useQuery` com `queryKey` incluindo busca (debounce), status, categoria, ordem e página; `placeholderData: keepPreviousData` para não piscar ao paginar. Remove o cálculo local de saídas e o filtro/sort em memória.
- Sem alterações em RLS: as políticas de leitura para o módulo Compras já existem em `itens`, `movimentacoes` e `movimentacao_itens`.
