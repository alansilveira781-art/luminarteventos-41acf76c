## Contexto

Na aba **Saídas** do módulo Estoque (`src/routes/saidas.tsx`), dois pontos causam a dificuldade:

1. **Maio não aparece**
   - A query `saidas` faz `.order("data_movimento", desc).limit(500)`. Se hoje já existem mais de 500 saídas mais recentes que maio, os registros de maio simplesmente não são carregados — nenhum filtro de período vai trazê-los de volta.
   - Além disso, o filtro padrão é `PeriodoPreset = "mes"` (mês atual), então mesmo com dados carregados o usuário precisa mudar o período para ver maio.

2. **Filtro de Evento genérico**
   - O filtro atual (linha 449) é um `<Select>` alimentado por `eventosDisponiveis` — apenas os valores distintos já digitados em `evento_projeto`. Não usa a lista unificada Planilha + Calendário como nos demais módulos.
   - Já existe `EventoSheetCombobox` importado no arquivo (usado no formulário de nova saída), pronto para reuso.

## Mudanças

### 1. `src/routes/saidas.tsx` — carregar tudo por período (sem limit fixo)

- Substituir a query única `["saidas"]` por uma consulta filtrada pelo `periodo` selecionado:
  - `queryKey: ["saidas", periodo.from, periodo.to]`
  - Usar `fetchAllRows` (paginado) em `movimentacoes` com `tipo=saida` e, quando houver `periodo.from/to`, aplicar `.gte("data_movimento", from)` e `.lte("data_movimento", to)` — assim o preset "Todos" ou "Personalizado" trazem qualquer mês (inclusive maio) sem o teto de 500.
  - Manter ordenação desc por `data_movimento`.
- Remover o `filterByPeriodo` client-side (fica redundante), mantendo a variável `gruposPeriodo` apenas como alias de `grupos` para não mexer no restante do render.
- Nenhuma mudança em mutations, agrupamento por requisição ou paginação.

### 2. `src/routes/saidas.tsx` — filtro de Evento igual aos outros módulos

- Trocar o `<Select>` de `filterEvento` (≈ linhas 449-460) por `EventoSheetCombobox`:
  ```tsx
  <EventoSheetCombobox
    value={filterEvento === "__all" ? null : filterEvento}
    onChange={(v) => setFilterEvento(v ?? "__all")}
    placeholder="Filtrar por evento…"
  />
  ```
- Remover o `useMemo` `eventosDisponiveis` (não é mais usado).
- A comparação em `filteredBaseList` (`m.evento_projeto === filterEvento`) continua válida, pois o combobox devolve o `id` do evento, mesmo formato salvo no campo.

Nada muda no formulário de cadastro/edição de saída — ele já usa `EventoSheetCombobox`.

## Validação

- Selecionar preset **Personalizado** cobrindo maio/2026: as saídas do mês devem aparecer normalmente, mesmo com mais de 500 registros posteriores.
- Preset **Todos**: carrega tudo (paginado), sem o teto de 500.
- Filtro de Evento: abre o combobox com busca, lista Planilha + Calendário, e ao selecionar um evento a tabela filtra pelo `id` correspondente.
- Filtros existentes (item, empresa, busca livre, ordenação, seleção em massa) seguem funcionando.
