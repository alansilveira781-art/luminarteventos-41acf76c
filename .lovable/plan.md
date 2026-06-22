## Plano — Dashboard Comercial refletir a base de Vendas

### Parte 1 — Corrigir zeramento (ano/mês/trimestre derivados)

**`src/lib/comercial/vendas-metrics.ts`**
- Adicionar helpers de derivação a partir da `VendaRow`:
  - `getAno(r)` → `r.anoEvento ?? r.ano ?? year(r.dataRegistro ?? r.dataEvento)`
  - `getMes(r)` → `r.mesEvento ?? r.mes ?? nomeMesPt(date)`
  - `getTrimestre(r)` → `r.trimestreEvento ?? trimestreFromMonth(date)`
- Reescrever `applyFilters` para usar esses helpers (ano/mês/trimestre tolerantes a NULL).
- Reescrever `evolucaoTrimestre`, `compararAnos` e qualquer agregação por período usando os mesmos helpers.

**`src/components/comercial/dashboard/FiltrosBar.tsx`**
- Lista de anos passa a usar `getAno(r)` em vez de `r.anoEvento ?? r.ano`.
- Garantir que o valor atualmente selecionado sempre aparece como opção.

**`src/lib/comercial/vendas-metrics.ts` (filtrosIniciais)**
- Alterar `ano` inicial para `"Todos"` (evita abrir num ano sem dados).
- Manter o `useEffect` em `comercial.dashboard.tsx` que ajusta para o último ano com dados se um ano específico estiver selecionado.

**Migration SQL (backfill idempotente)**
- `UPDATE public.comercial_vendas` preenchendo `ano`, `ano_evento`, `mes`, `mes_evento`, `trimestre_evento` quando NULL, a partir de `COALESCE(data_registro, data_evento)`:
  - `ano / ano_evento` = `EXTRACT(YEAR FROM ...)`
  - `mes / mes_evento` = nome do mês em pt-BR (CASE com `EXTRACT(MONTH …)`)
  - `trimestre_evento` = `CEIL(month/3.0)`

### Parte 2 — Ligar cards à base

Adicionar agregações em `vendas-metrics.ts` (todas operam sobre `filtered`):
- `comissoesPorVendedor(rows)` já existe usando `valorBV` → trocar para somar `valorComissao` por consultor. Adicionar `totalComissao` e `totalBV` como indicadores.
- `rankingCerimonial` / `vendasPorCerimonial` → group by `cerimonial`, soma de `valorFinal` (já existe `rankingCerimonial`; conectar nos cards).
- `rankingDecorador` / `vendasPorDecorador` → group by `decorador`, soma de `valorFinal` (já existe; conectar nos cards).
- Real vs Meta: `realizado = sum(valorFinal)` do `filtered`, `meta = META_DEFAULT` (12.000.000).

Conectar nas sub-rotas correspondentes:
- `src/routes/comercial.dashboard.painel.tsx` — Gauge Real vs Meta, Vendas por Cerimonial, Vendas por Decorador.
- `src/routes/comercial.dashboard.relatorios.tsx` — Comissões vendedores (com `valorComissao`) + total de BV.
- `src/routes/comercial.dashboard.vendedores.tsx` — Rankings Cerimonial/Decorador conectados.

(Leitura prévia de cada sub-rota para confirmar nomes exatos dos cards antes da edição.)

### Parte 3 — Tempo real

**`src/routes/comercial.dashboard.tsx`**
- Reduzir `staleTime` de `["comercial-vendas-db"]` para 30s.
- Adicionar `useEffect` que assina canal Supabase Realtime em `comercial_vendas` (INSERT/UPDATE/DELETE) e chama `qc.invalidateQueries({ queryKey: ["comercial-vendas-db"] })`. Cleanup com `removeChannel`.

**Migration** (idempotente):
- `ALTER TABLE public.comercial_vendas REPLICA IDENTITY FULL;`
- Adicionar à publicação `supabase_realtime` se ainda não estiver (verificar via `pg_publication_tables`).

### Parte 4 — Remover Dropbox do Dashboard

**`src/routes/comercial.dashboard.tsx`**
- Remover: texto "Base local · Última sincronização", botões "Importar .xlsx" e "Sincronizar agora", `fileInputRef`, `handleUpload`, `handleSyncDropbox`, query `["comercial-vendas-last-sync"]`, imports `getLastSync`, `syncVendasFromDropbox`, `syncVendasFromUpload`, ícones `Upload`/`CloudDownload`.
- Manter apenas o botão "Atualizar" que invalida `["comercial-vendas-db"]`.
- Trocar `description` do `PageHeader` para algo neutro (ex: "Vendas cadastradas manualmente").

### Validação

1. Abrir Dashboard com vendas 2026: KPIs e gráficos com valores reais; seletor de Ano com 2026 disponível e não vazio.
2. Cards "Comissões vendedores", "Ranking Cerimonial/Agência", "Ranking Decorador", "Vendas por Cerimonial/Agência", "Vendas por Decorador", "Real vs Meta" exibem dados.
3. Cadastrar nova venda em /comercial/vendas → Dashboard atualiza sem reload (via invalidação + Realtime).
4. Vendas antigas com data nula passam a aparecer após backfill.
5. Sem botões de Dropbox no cabeçalho.

### Fora de escopo
- Não alterar cálculo de Valor Final/BV/Comissão (definidos na venda).
- Não trocar fonte de dados (continua `comercial_vendas` via `listVendasDb`).
- Não tocar em Estoque/Compras/Patrimônio.
