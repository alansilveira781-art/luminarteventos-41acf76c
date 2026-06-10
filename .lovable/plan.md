
## Objetivo

Criar um Dashboard dentro do módulo **Comercial** com 4 seções, uma para cada painel das imagens enviadas. Os dados virão do arquivo **CONTROLE-DE-VENDAS-NOVO.xlsx** (Dropbox), aba `Base de Dados` (995 linhas, 32 colunas: Data, Ano, Mês, Tipo, Quantidade, Nome do Evento, Local, Estado, Cidade, Tipo de Evento, Classificação, Data do Evento, Consultor, Gestor, Cerimonial, Decorador, Empresa, Valor da proposta, Desconto, Percentual, Valor Final, Comissão Consultor/Gestor etc.).

Mais adiante migramos a fonte para o próprio sistema, sem mexer na UI.

## Estrutura de navegação

Nova entrada **Dashboard** no menu do módulo Comercial:

- Rota pai: `/comercial/dashboard` (com sub-abas)
  - `painel` → **Painel de Vendas**
  - `relatorios` → **Relatórios de Vendas**
  - `vendedores` → **Vendedores**
  - `indicadores` → **Indicadores**

Filtros globais no topo (compartilhados entre as 4 abas, com persistência via `usePersistedState`):
- Empresa, Ano, Mês (Trimestre só na aba Indicadores), Consultor, Classificação — replicando os comboboxes das imagens.

## Fonte de dados

Server function `listVendasDropbox` em `src/lib/comercial/vendas.functions.ts`:
- Faz `fetch` do link Dropbox (forçando `dl=1`).
- Parseia o xlsx no servidor com **SheetJS** (`xlsx` — pure JS, roda no Worker).
- Lê só a aba `Base de Dados`, normaliza tipos (datas → ISO, números, strings) e devolve `rows: VendaRow[]` + um `fetchedAt`.
- Cache em memória de processo por ~5 min para evitar re-download a cada navegação.
- Retorno: `{ rows, fetchedAt, error? }`.

Hook cliente `useVendasDropbox()` usando TanStack Query (`queryKey: ['vendas-dropbox']`, `staleTime: 5 min`). Loader da rota faz `ensureQueryData`; componente lê via `useSuspenseQuery`. Boundaries: `errorComponent` + `notFoundComponent` na rota.

## Cálculos (puros, no cliente)

Arquivo `src/lib/comercial/vendas-metrics.ts` com funções puras que recebem `VendaRow[]` já filtrado:
- `kpis(rows, prevRows)` → Vendas Totais (Σ Valor Final), Quantidade (Σ Quantidade onde Tipo=VENDA), Desconto (Σ Desconto), Ticket Médio (vendas / qtde) + % vs período anterior.
- `evolucaoTrimestre(rows)` → `[{ trim: '1º Trim', valor, qtde, ticket }]`.
- `rankingConsultor(rows)` → agregado por Consultor.
- `valorPorClassificacao(rows)` → por Classificação.
- `rankingCerimonial(rows)`, `rankingDecorador(rows)` (Top N).
- `comissoesPorVendedor(rows)` → Σ Comissão Consultor.
- `vendasPorTipoEvento(rows)` → por Tipo de Evento.
- `comparativoAnoAxAnoB(rows, anoA, anoB)` → série trimestral + tabela de indicadores + pizza por Classificação para cada ano.
- `realVsMeta(rows, meta)` → para o gauge (meta configurável; default ex. R$ 12 Mi, ajustável depois).

## Conteúdo de cada seção

**1. Painel de Vendas** (`/comercial/dashboard/painel`)
- 4 KPI cards (Vendas, Qtde, Desconto, Ticket) com período anterior + % LY.
- Linha: Evolução de Vendas por trimestre.
- Linha: Evolução do Ticket Médio + Qtde (eixo duplo).
- Barras horizontais: Ranking Consultores.
- Barras horizontais: Valor Final por Classificação.
- Gauge: Real vs Meta.

**2. Relatórios de Vendas** (`/comercial/dashboard/relatorios`)
- Mesmos 4 KPIs.
- Tabela detalhada (Data, Nome do Evento, Local, Consultor, Decorador, Cerimonial, Valor Final) com total no rodapé, ordenação e busca.
- Barras: Comissões Vendedores.
- Barras: Ranking Cerimonial/Agência.
- Barras: Ranking Decorador.
- Gauge: Real vs Meta.
- Botão **Exportar para Excel** (xlsx).

**3. Vendedores** (`/comercial/dashboard/vendedores`)
- 3 KPIs (Vendas, Qtde, Ticket).
- Chips/botões dos vendedores (clicar filtra a aba por consultor).
- Linha: Evolução de Vendas por trimestre.
- Barras: Vendas por tipo de evento.
- Barras: Vendas por Cerimonial/Agência.
- Barras: Vendas por Decorador.

**4. Indicadores** (`/comercial/dashboard/indicadores`)
- Inputs Ano A / Ano B (default ano atual vs anterior).
- Linhas comparativas Ano A vs Ano B por trimestre.
- Tabela: Vendas totais, Qtde, Ticket, Desconto — Ano A, Ano B, %.
- Pizza por Classificação para Ano A e Ano B (lado a lado).

## Bibliotecas

- `xlsx` (SheetJS) — parse no servidor e export no cliente. Adicionar via `bun add xlsx`.
- Gráficos: **Recharts** (já no projeto pelo `chart.tsx`). Gauge via `RadialBarChart`.

## Permissões

Reutilizar `comercial.tsx` (já gate `hasModule('comercial') || isAdmin`). Sem novas roles.

## Arquivos a criar / alterar

Criar:
- `src/lib/comercial/vendas.functions.ts` — server fn + cache.
- `src/lib/comercial/vendas-metrics.ts` — cálculos puros + tipos `VendaRow`.
- `src/lib/comercial/vendas-export.ts` — export xlsx (client).
- `src/routes/comercial.dashboard.tsx` — layout com sub-tabs + filtros globais (Outlet).
- `src/routes/comercial.dashboard.painel.tsx`
- `src/routes/comercial.dashboard.relatorios.tsx`
- `src/routes/comercial.dashboard.vendedores.tsx`
- `src/routes/comercial.dashboard.indicadores.tsx`
- `src/components/comercial/dashboard/` — `KpiCard.tsx`, `GaugeRealVsMeta.tsx`, `FiltrosBar.tsx`, helpers de gráfico.

Alterar:
- `src/components/AppSidebar.tsx` — adicionar item **Dashboard** no grupo Comercial.

## Fora de escopo (próximas iterações)

- Substituir Dropbox por dados do banco (`propostas`/cards do módulo).
- Meta editável por ano/empresa.
- Filtros adicionais (Trimestre nas demais abas, multi-seleção).
