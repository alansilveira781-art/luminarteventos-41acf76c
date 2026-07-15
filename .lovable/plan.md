## Objetivo

Adicionar aba **Relatórios** no módulo Financeiro (Despesas), com uma seção **Cartões** que consolida demandas + compras filtradas por cartão (condição de pagamento) e período, com impressão.

## 1. Nova rota e navegação

- Criar `src/routes/financeiro.relatorios.tsx` (rota `/financeiro/relatorios`), no mesmo padrão de `financeiro.dashboard.tsx` / `financeiro.configuracoes.tsx`.
- Registrar no `src/components/AppSidebar.tsx` na lista do grupo "Despesas" (`module: "financeiro"`), item "Relatórios" com ícone `FileText`, logo abaixo de "Configurações" (ou antes — sem alterar as demais entradas).

## 2. Filtros no topo da seção "Cartões"

- **Cartão** (obrigatório): `<Select>` carregado da tabela `condicoes_pagamento` (`nome`).
- **Período**: reutilizar `PeriodoFilter` (`src/components/PeriodoFilter.tsx`), default "mês".
- Sem cartão selecionado, o relatório fica vazio com placeholder pedindo para escolher um cartão.

## 3. Consulta de dados

Duas queries em paralelo via `@tanstack/react-query`, usando `fetchAllRows` quando necessário para paginação segura:

- `compras`: `select id, numero, titulo, solicitante, comprador, descritivo, valor_total, condicao_pagamento, data_compra, status`
  filtrar `condicao_pagamento = cartão` e `status in ('finalizado','a_receber')` e data dentro do período (usar `data_compra` — mesmo campo já usado nos filtros existentes; fallback para `created_at` se `data_compra` for nulo).
- `demandas`: mesmos campos equivalentes (`descritivo`, `condicao_pagamento`, `data_solicitacao`/`data_compra`, mesmos status).
- `compra_itens` e `demanda_itens`: carregar em batch usando `.in('compra_id', ids)` / `.in('demanda_id', ids)`, selecionar `descricao/nome, quantidade`, agrupar por id pai.

## 4. Tabela

Uma tabela única combinando os dois tipos, colunas:

| Tipo | Título | Solicitante | Comprador | Itens ou Descritivo | Valor total |

- **Tipo**: `DEMANDA-{numero}` ou `COMPRA-{numero}`.
- **Itens/Descritivo**:
  - Se houver linhas em `compra_itens`/`demanda_itens`: listar todos como "{qtd}x {descrição}" (um por linha na célula).
  - Se não houver: usar `descritivo`; para compras sem descritivo, cair para `titulo`/`observacao`.
- Ordenação: por Tipo (COMPRA antes de DEMANDA, ou alfabético) e depois por número desc — agrupa visualmente.
- Rodapé: **Total geral** + subtotais de Compras e Demandas, formatados em `R$` (usar `Intl.NumberFormat`).

## 5. Impressão

- Botão **Imprimir** chama `window.print()`.
- Bloco de impressão com CSS `@media print`:
  - Ocultar sidebar, header, filtros e botões (classe `print:hidden` do Tailwind).
  - Mostrar cabeçalho de impressão com: nome da empresa (constante do projeto), "Relatório de Cartão — {nome do cartão}", período formatado, data de emissão.
  - Tabela completa com itens listados e total geral.
- Reaproveitar padrão de impressão do módulo Comercial (`comercial.dashboard.relatorios.tsx` / `RelatorioVendasPeriodo`).

## Detalhes técnicos

- Arquivo novo: `src/routes/financeiro.relatorios.tsx` (`createFileRoute("/financeiro/relatorios")`).
- Sem migrations, sem edge functions, sem alterações no schema.
- Sem alterações em `KanbanFilters`, `compras.index.tsx`, `financeiro.index.tsx`.
- Verificação: confirmar nomes de colunas `condicao_pagamento`, `descritivo`, `numero`, `data_compra` em `compras` e `demandas` via `supabase--read_query` antes de escrever a query final (ajustar se algum campo tiver nome diferente).

## Confirmações após build

1. Aba "Relatórios" aparece no sidebar do Financeiro.
2. Seção Cartões filtra por cartão + período, só traz `finalizado`/`a_receber`.
3. Tabela mostra Tipo (DEMANDA-XX/COMPRA-XX), Título, Solicitante, Comprador, Itens/Descritivo (todos os itens quando houver vários) e Valor total.
4. Total geral fecha com a soma das linhas.
5. Impressão gera versão limpa com cabeçalho, tabela e total.