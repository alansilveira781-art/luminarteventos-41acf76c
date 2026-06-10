## Refatorar filtros por aba e adicionar seção Propostas

### 1) FiltrosBar configurável
Adicionar prop `fields?: Array<"empresa"|"ano"|"mes"|"trimestre"|"consultor"|"classificacao">` em `src/components/comercial/dashboard/FiltrosBar.tsx`. Default mantém todos os campos (compatível). Renderização condicional por campo.

### 2) Layout do dashboard (`comercial.dashboard.tsx`)
Remover o `<FiltrosBar>` global do layout — cada aba renderiza o seu próprio. Adicionar a aba **Propostas** ao array `TABS`. Manter o contexto `useDashboard()` intacto.

### 3) Filtros por aba
- **Painel** (`/painel`): `["empresa","ano","mes"]`
- **Relatórios** (`/relatorios`): `["empresa","ano","mes"]`
- **Vendedores** (`/vendedores`): `["empresa","ano","mes"]` — blocos por consultor derivados de `applyFilters(rows, { ...filtros, consultor: "Todos" })`, mostrando apenas consultores presentes no recorte.
- **Indicadores** (`/indicadores`): `["empresa","trimestre","consultor","classificacao"]` — remove Ano/Mês.

Cada rota adiciona `<Card><FiltrosBar fields={...} rows={rows} filtros={filtros} onChange={setFiltros} /></Card>` no topo da página.

### 4) Nova aba Propostas
Criar `src/routes/comercial.dashboard.propostas.tsx` e `src/lib/comercial/propostas-metrics.ts`.

Fonte: `useComercial().propostas` (store local, sem migração).

Filtros: `["empresa","ano","mes"]` — filtragem por `p.evento.dataInicio` (Ano/Mês) e `p.empresa` quando existir no objeto.

Métricas em `propostas-metrics.ts`:
- `aplicarFiltrosPropostas(propostas, filtros)`
- `kpisPropostas`: total criadas, enviadas, em negociação, fechadas, perdidas
- Taxa de conversão (fechadas / criadas) e ticket médio (soma valor fechadas / qtd fechadas)
- `evolucaoMensalPropostas`: série criadas vs fechadas por mês
- `rankingConsultorPropostas`: qtd e valor de propostas fechadas por consultor

UI:
- 5 `KpiCard` (criadas/enviadas/em negociação/fechadas/perdidas)
- 2 KpiCard adicionais: taxa de conversão (%) e ticket médio (R$)
- `LineChart` evolução mensal (criadas vs fechadas)
- `BarChart` ranking por consultor (valor fechado)
- Tabela com top propostas fechadas

### 5) Arquivos
**Criar:** `src/routes/comercial.dashboard.propostas.tsx`, `src/lib/comercial/propostas-metrics.ts`
**Editar:** `src/components/comercial/dashboard/FiltrosBar.tsx`, `src/routes/comercial.dashboard.tsx`, `src/routes/comercial.dashboard.painel.tsx`, `src/routes/comercial.dashboard.relatorios.tsx`, `src/routes/comercial.dashboard.vendedores.tsx`, `src/routes/comercial.dashboard.indicadores.tsx`

### Fora de escopo
Nenhuma migração de banco, nenhuma alteração no parser do Dropbox, nenhuma mudança de layout/cores.
