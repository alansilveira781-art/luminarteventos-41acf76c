# Modo "Conferência" no relatório de Patrimônio

Nova visualização na aba Relatórios do Patrimônio para imprimir uma folha de contagem física: cada item aparece com a quantidade do sistema e uma coluna em branco para anotar à mão a quantidade contada.

## O que muda

- O seletor "Visualização" ganha a opção **Conferência (folha de contagem)**, ao lado de Detalhado e Consolidado por nome.
- O agrupamento é o mesmo do consolidado: **nome + especificação** (normalizados). Todos os filtros atuais (busca, categoria, subcategoria, estado, localização) continuam valendo.
- Tabela na tela com: Item (`NOME · Especificação`), Categoria, Qtd. sistema e uma coluna "Qtd. conferida" exibida como campo em branco (apenas visual, nada é salvo).
- **Exportar PDF** no modo conferência gera a folha de contagem: colunas Item, Categoria, Qtd. sistema, Qtd. conferida (célula vazia) e Observações (célula vazia), com linhas mais altas para escrita à mão, numeração de páginas e espaço para responsável/data no rodapé.
- Ordenação por Nome (A–Z) como padrão neste modo, com opção de maior quantidade.

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`: adicionar `"conferencia"` ao estado `modo`; reutilizar o `useMemo` `consolidado` como fonte das linhas; nova tabela para o modo conferência; `exportar()` chama o novo gerador quando `modo === "conferencia"`.
- `src/lib/patrimonio/relatorio-pdf.ts`: nova função `gerarFolhaConferenciaPatrimonioPdf` reutilizando cabeçalho/rodapé e helpers existentes (A4 retrato, `minCellHeight` maior, colunas em branco).
- Sem mudanças de banco de dados.
