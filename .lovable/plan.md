# Projeção de materiais como seção própria + filtros do Estoque preservados

## 1. Aba Relatórios (Estoque) dividida em duas seções

A tela passa a ter duas abas no topo:

- **Relatórios** — exatamente a interface atual (tipo de relatório, período, item, filtros de evento/tipo/solicitante/fornecedor, prévia, CSV e PDF). O tipo "Projeção de materiais" sai da lista de tipos, já que vira seção própria.
- **Projeção** — nova seção de levantamento.

### Seção Projeção

- Seleção de materiais usando o **mesmo campo "Item"** da primeira seção (busca por nome/código, múltipla seleção, chips dos selecionados).
- Tabela com uma linha por item selecionado:
  - Item (código — nome)
  - **Quantidade**: campo digitável pelo usuário (padrão 0), com decimais no padrão brasileiro
  - UN (unidade cadastrada)
  - Valor unitário (do cadastro)
  - Total da linha (quantidade digitada × valor unitário)
- Rodapé com **quantidade total** e **valor total** do levantamento.
- Itens sem saldo continuam aparecendo normalmente (a projeção é sobre o que se pretende levantar, não sobre o saldo).
- Botão **Exportar PDF** no mesmo padrão visual e de layout dos PDFs já usados nesta aba (cabeçalho com título, data de geração, tabela e totais).

## 2. Estoque: não perder os filtros ao voltar do histórico

Hoje, ao abrir o histórico de movimentação de um item e voltar para a lista, todos os filtros são reiniciados. Os filtros da aba Estoque passam a ser lembrados (busca, categoria, ocultar zerados, período, ordenação e página), voltando exatamente como estavam. Continuam valendo depois de recarregar a página, e há como limpar normalmente pelos próprios campos.

## Detalhes técnicos

- `src/routes/relatorios.tsx`: envolver o conteúdo atual em `Tabs` (`relatorios` | `projecao`); extrair o multi-select de itens hoje inline num componente reutilizável (`ItensMultiSelect`) usado nas duas abas. Remover `projecao_materiais` de `REPORTS`/`ReportId` e do `loadReport`/`formatReport`.
- Nova seção lê `itens` (id, nome, codigo, unidade, valor_unitario) via a query de itens já existente na página; quantidades ficam em estado local `Record<itemId, number>` usando `QuantidadeInput` (`src/components/QuantidadeInput.tsx`).
- PDF: reutilizar o mesmo carregamento dinâmico de `jspdf` + `jspdf-autotable` já presente em `exportPdf`, gerando `projecao_materiais_<data>.pdf` em A4 retrato.
- `src/routes/estoque.index.tsx`: trocar `useState` por `usePersistedState` (`src/hooks/usePersistedState.ts`) nos estados `q`, `categoriaFilter`, `hideZero`, `sort`, `periodoPreset`, `periodo` e `page`, com chaves prefixadas `estoque:*`.
- Nenhuma alteração de banco de dados.
