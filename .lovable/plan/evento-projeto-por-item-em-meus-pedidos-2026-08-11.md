# Evento / Projeto por item em Meus Pedidos

## O que muda

No detalhe de um pedido (Meus Pedidos), a tabela de Itens ganha a coluna **Evento / Projeto**, mostrando o evento vinculado a cada item quando houver, e "—" quando não houver.

Vale tanto para pedidos de Compra quanto de Despesa: as duas tabelas de itens já guardam esse campo, então despesas antigas sem evento simplesmente aparecem com "—".

## Detalhes técnicos

- `src/routes/meus-pedidos.tsx`: incluir `evento_projeto` no `select` da consulta de itens (`compra_itens` / `demanda_itens`) e adicionar a coluna correspondente no cabeçalho e nas linhas da tabela, ajustando o `colSpan` da linha de Total.
- Somente leitura; nenhuma mudança de banco ou de permissões.
