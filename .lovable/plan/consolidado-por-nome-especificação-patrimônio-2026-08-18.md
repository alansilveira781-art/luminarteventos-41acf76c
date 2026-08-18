# Consolidado por nome + especificação (Patrimônio)

Hoje o modo "Consolidado por nome" agrupa somente pelo nome do item, então itens com o mesmo nome mas especificações diferentes (ex.: "ARCO · 2m" e "ARCO · 3m") caem na mesma linha. O agrupamento passa a considerar nome **e** especificação.

## O que muda

- A chave de agrupamento passa a ser `nome + especificação` (ambos normalizados: sem acentos, sem diferença de maiúsculas, espaços extras removidos). Itens sem especificação formam seu próprio grupo.
- A tabela do modo consolidado ganha a especificação junto ao nome (`NOME · Especificação`, no mesmo estilo do inventário), ou uma coluna própria "Especificação".
- O PDF consolidado passa a incluir a especificação na coluna Item, no mesmo formato.
- Ordenação, filtros, quantidade somada, nº de registros, valor total e valor médio continuam funcionando igual — apenas o critério de agrupamento fica mais específico.

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`: no `useMemo` `consolidado`, montar a chave com `normalize(nome) + "|" + normalize(especificacao)`; guardar também o rótulo de especificação mais frequente no grupo; exibir na célula da tabela e enviar ao PDF.
- `src/lib/patrimonio/relatorio-pdf.ts`: `gerarRelatorioPatrimonioConsolidadoPdf` aceita `especificacao` na linha e concatena na coluna Item com `overflow: linebreak`.
- Sem mudanças de banco de dados.
