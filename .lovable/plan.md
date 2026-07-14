## Objetivo

Nos quadros **Compras** (`/compras`) e **Despesas** (`/financeiro`), permitir que o usuário adicione filtros por qualquer campo do card, com múltiplos filtros ativos ao mesmo tempo (ex.: Fornecedor = X **e** Comprador = Y **e** Responsável = Z).

## Comportamento (UX)

Ao lado da busca atual, um botão **"+ Filtro"** abre um popover:

1. **Escolha o campo** (lista): Status, Fornecedor, Solicitante, Comprador, Responsável, Tipo, Empresa faturada (só compras), Tem NF (só compras), Data de compra/serviço (intervalo), Valor (mín/máx).
2. Para campos categóricos → um **select múltiplo** com os valores distintos existentes nos cards.
3. Para datas → dois inputs `date` (de/até).
4. Para valor → dois inputs numéricos (mín/máx).

Filtros ativos aparecem como **chips** logo abaixo da barra de busca. Cada chip mostra `Campo: valor1, valor2` com um "×" para remover. Botão **"Limpar filtros"** aparece quando há ≥1 chip.

A busca textual atual continua funcionando em paralelo (AND com os filtros).

Os filtros são **persistidos por usuário/quadro** via `usePersistedState` (localStorage), com chaves `compras.kanban.filters` e `demandas.kanban.filters`.

## Alterações técnicas

**Novo componente** `src/components/KanbanFilters.tsx`:
- Props: `rows`, `fieldsConfig` (declaração dos campos: chave, label, tipo `multi|date-range|number-range`, `getValue(row)`), `value`, `onChange`.
- Renderiza botão "+ Filtro" + popover (usa `Popover`, `Command` do shadcn já presentes).
- Renderiza chips dos filtros ativos + "Limpar".
- Exporta `applyKanbanFilters(rows, filters, fieldsConfig)` para aplicar no memo.

**`src/routes/compras.index.tsx`**:
- Declarar `fieldsConfig` com: status, fornecedor, solicitante, comprador, responsavel_nome, tipo_compra, empresa_faturada, tem_nf, data_compra (range), data_servico (range), valor_total (range).
- Estado `filters` (persistido). Aplicar `applyKanbanFilters` no `useMemo` de `filtered` antes/depois do filtro de texto.
- Inserir `<KanbanFilters …/>` ao lado da busca.

**`src/routes/financeiro.index.tsx`** (Despesas):
- Mesmo tratamento; `fieldsConfig` com: status, fornecedor, solicitante, comprador, responsavel_nome, tipo_demanda, data_compra (range), valor_total (range).

Sem mudanças de schema, backend, ou lógica de negócio — apenas UI/estado de tela.

## Diagrama do topo do quadro

```text
[ Buscar…            ]  [ + Filtro ]
[Fornecedor: ACME ×] [Responsável: João, Maria ×] [Limpar]
```
