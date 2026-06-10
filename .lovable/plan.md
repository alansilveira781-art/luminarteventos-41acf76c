## Objetivo

Persistir a planilha **CONTROLE DE VENDAS NOVO** numa tabela do banco e fazer todo o Dashboard Comercial ler dela (em vez de baixar o `.xlsx` do Dropbox a cada acesso). Sincronização por **upsert** (chave `nome_evento + data_evento`), com **botão manual** + **job diário automático** + **upload manual de .xlsx**.

## 1) Tabela `comercial_vendas`

Campos espelhando o parser atual (`src/lib/comercial/vendas.functions.ts → VendaRow`):

- Identificação: `id` (uuid), `nome_evento`, `data_evento`, `data_registro`
- Tempo derivado: `ano`, `mes`, `mes_evento`, `ano_evento`, `trimestre_evento`, `semana`
- Local: `local`, `estado`, `cidade`, `salao`
- Classificação: `tipo`, `tipo_evento`, `classificacao`, `empresa`
- Pessoas: `consultor`, `gestor`, `cerimonial`, `decorador`
- Financeiro: `quantidade`, `valor_proposta`, `desconto`, `percentual`, `valor_final`, `valor_bv`, `comissao_gestor`, `tipo_comissao`, `comissao_consultor`
- Metadados: `source` ("dropbox" | "upload"), `row_hash`, `created_at`, `updated_at`

**Chave única para upsert:** `UNIQUE (nome_evento, data_evento)` (com `data_evento` podendo ser nulo → fallback usa `data_registro`).

**Tabela auxiliar `comercial_vendas_sync`**: histórico de sincronizações (`id`, `started_at`, `finished_at`, `source`, `rows_total`, `rows_inserted`, `rows_updated`, `status`, `error`).

**RLS:** habilitada; SELECT/INSERT/UPDATE/DELETE para `authenticated`; `service_role` total.

## 2) Camada de servidor

Em `src/lib/comercial/vendas-db.functions.ts` (createServerFn):

- `listVendasDb()` — lê tudo de `comercial_vendas` (substitui `listVendasDropbox` nas telas do dashboard).
- `getLastSync()` — última linha de `comercial_vendas_sync`.
- `syncVendasFromDropbox()` — baixa do link do Dropbox, parseia e faz upsert (chave `nome_evento+data_evento`). Requer admin (`has_role`).
- `syncVendasFromUpload({ base64Xlsx })` — recebe arquivo enviado pelo usuário, parseia e faz upsert. Requer admin.

O parser xlsx atual é reaproveitado (extraído de `vendas.functions.ts` para `vendas-parse.server.ts`).

## 3) Job diário

`pg_cron` chama `POST /api/public/hooks/comercial-vendas-sync` 1x/dia (03:00) com `apikey`. A rota executa `syncVendasFromDropbox` via `supabaseAdmin`.

## 4) UI no Dashboard (`src/routes/comercial/dashboard.tsx`)

- Substituir `useQuery(listVendasDropbox)` por `useQuery(listVendasDb)`.
- No header (ao lado do "Atualizar"):
  - Botão **Sincronizar agora** (chama `syncVendasFromDropbox`, toast com inserted/updated, invalida query).
  - Botão **Importar .xlsx** (abre dialog com input file → `syncVendasFromUpload`).
  - Texto "Última sincronização: …" lendo `getLastSync()`.
- Demais abas (Painel, Relatórios, Vendedores, Indicadores, Propostas) **não mudam** — continuam usando o contexto `useDashboard()`.

## 5) Out of scope

- Sem mudança de layout, KPIs ou gráficos.
- Sem alteração no módulo Propostas (continua com store local).
- O server-fn antigo `listVendasDropbox` fica disponível só para o sync (não é mais chamado pelo cliente).

## Pergunta antes de implementar

Os botões "Sincronizar agora" e "Importar .xlsx" devem aparecer **só para admins** (`has_role admin`) ou para **qualquer usuário autenticado** do módulo comercial?
