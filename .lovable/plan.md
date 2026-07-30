## Problema

A tabela `itens` tem **4.864 registros**, mas a API do banco devolve no máximo **1.000 linhas por requisição** — o `.limit(5000)` usado em `src/routes/relatorios.tsx` não ultrapassa esse teto. Por isso o relatório de Estoque (e o seletor de itens do filtro) mostra apenas parte dos itens.

## Solução

Usar o helper de paginação já existente no projeto (`fetchAllRows` em `src/lib/fetch-all.ts`), que busca em blocos de 1.000 até trazer tudo.

### Alterações em `src/routes/relatorios.tsx`

1. **Seletor de itens do filtro** (linha ~63): trocar a consulta com `.limit(5000)` por `fetchAllRows("itens", "id,nome,codigo", { orderBy: { column: "nome" } })`, para que todos os 4.864 itens fiquem disponíveis na busca.
2. **Relatório "estoque"** (linha ~384): buscar todos os itens paginando; quando houver filtro de itens selecionados, manter o `.in("id", ...)` (nesse caso o volume é pequeno).
3. **Relatório "estoque_negativo"** (linha ~390): mesma paginação, preservando o filtro `quantidade_atual < 0` e a ordenação.
4. **Relatórios de movimentações** (saídas, entradas, devoluções, ajustes, gastos): aplicar a mesma paginação por blocos, já que também podem passar de 1.000 linhas no período e hoje ficam silenciosamente truncados.

Nenhuma mudança de layout, colunas ou exportação — apenas o carregamento completo dos dados.

## Detalhe técnico

`fetchAllRows` aceita apenas tabela/colunas/ordenação; para as consultas com filtros (`.eq`, `.gte`, `.in`) será usado o mesmo padrão de laço com `.range(from, from + 999)` diretamente na query, repetindo até a página vir incompleta.
