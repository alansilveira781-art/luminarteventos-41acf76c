# Relatório consolidado por nome do item (Patrimônio)

Na aba Relatórios do Patrimônio, além da listagem item a item que existe hoje, será adicionado um modo **Consolidado por nome**: linhas repetidas com o mesmo nome (ex.: vários "ARCO") viram uma única linha com a quantidade somada.

## O que muda

- Novo seletor "Visualização": **Detalhado** (como hoje) ou **Consolidado por nome**.
- No modo consolidado, a tabela mostra:
  - Nome do item
  - Categoria e Subcategoria (quando iguais em todos os registros; senão "Vários")
  - Quantidade total somada
  - Nº de registros agrupados
  - Valor total (soma de valor unitário x quantidade) e valor unitário médio
- Agrupamento pelo nome normalizado (ignora maiúsculas/minúsculas, acentos e espaços extras), exibindo o nome mais frequente.
- Todos os filtros atuais (busca, categoria, subcategoria, estado, localização) continuam valendo antes do agrupamento.
- Ordenação padrão por quantidade decrescente, com opção de ordenar por nome.
- **Exportar PDF** respeita a visualização escolhida: no consolidado sai um PDF enxuto com Nome, Categoria, Qtd., Valor unit. médio e Valor total, com total geral e numeração de páginas no mesmo padrão atual.

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`: novo estado `modo` ("detalhado" | "consolidado"); `useMemo` que agrupa `filtrados` por `normalize(nome)` somando quantidade e valor; tabela alternativa para o modo consolidado; o botão de exportar decide qual gerador chamar.
- `src/lib/patrimonio/relatorio-pdf.ts`: nova função `gerarRelatorioPatrimonioConsolidadoPdf` (mesmo cabeçalho/rodapé, A4 retrato, colunas reduzidas), reutilizando os helpers de formatação já existentes.
- Sem mudanças de banco de dados.
