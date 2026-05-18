## Objetivo

Conectar o sistema ao **Conta Azul** em modo **somente leitura** (Conta Azul → Lovable), puxando periodicamente:

- **Plano de Contas**
- **Centros de Custo**
- **Contas a Pagar**
- **Contas a Receber**
- **Movimentação de Extrato** (transações bancárias)

Os dados ficam armazenados em tabelas locais (cache), e novos **dashboards** no módulo Financeiro consomem essas tabelas — substituindo o que hoje está no Power BI.

A integração usa **uma única conexão da empresa** (OAuth feito uma vez por um admin).

---

## 1. Credenciais e secrets

Antes do código:

- Você precisa garantir, no painel do **Conta Azul Developers**, que o App tem como **Redirect URI** cadastrada:
  - Produção: `https://luminarteventos.lovable.app/api/contaazul/oauth/callback`
  - Preview: `https://id-preview--6426c238-9a04-43ca-bcba-50cca625fad7.lovable.app/api/contaazul/oauth/callback`
- Vou pedir 2 secrets (via `add_secret`):
  - `CONTA_AZUL_CLIENT_ID`
  - `CONTA_AZUL_CLIENT_SECRET`

---

## 2. Banco de dados (migration)

Tabelas novas (todas com RLS exigindo acesso ao módulo `financeiro`; tabela de credenciais restrita a admin):

- **`conta_azul_credentials`** (linha única): `access_token`, `refresh_token`, `expires_at`, `scope`, `connected_by`, `connected_at`, `updated_at`. Acesso: somente admin do módulo.
- **`ca_plano_contas`**: `id` (uuid local), `external_id`, `codigo`, `nome`, `tipo` (receita/despesa), `pai_external_id`, `ativo`, `synced_at`.
- **`ca_centros_custo`**: `id`, `external_id`, `nome`, `ativo`, `synced_at`.
- **`ca_contas_pagar`**: `id`, `external_id`, `descricao`, `fornecedor_nome`, `categoria_external_id`, `centro_custo_external_id`, `valor`, `data_vencimento`, `data_pagamento`, `status` (em_aberto/pago/atrasado), `documento`, `observacoes`, `synced_at`.
- **`ca_contas_receber`**: mesma estrutura, trocando fornecedor por `cliente_nome`.
- **`ca_extrato`**: `id`, `external_id`, `conta_bancaria`, `data`, `descricao`, `valor`, `tipo` (credito/debito), `categoria_external_id`, `centro_custo_external_id`, `synced_at`.
- **`ca_sync_log`**: `id`, `recurso`, `started_at`, `finished_at`, `status` (ok/erro), `mensagem`, `qtd_registros`.

Índices em `external_id`, `data_vencimento`, `data`, `status`.

---

## 3. Fluxo OAuth (server routes)

Três arquivos em `src/routes/api/contaazul/`:

- **`oauth.start.ts`** (`GET /api/contaazul/oauth/start`): exige usuário admin, gera `state` aleatório (salvo em cookie httpOnly), redireciona para a URL de autorização do Conta Azul com os scopes necessários (leitura financeira, contas a pagar/receber, plano de contas, centros de custo, extrato).
- **`oauth.callback.ts`** (`GET /api/contaazul/oauth/callback`): valida `state`, troca o `code` pelos tokens, salva em `conta_azul_credentials`, redireciona para `/financeiro/conta-azul` com mensagem de sucesso.
- **`oauth.disconnect.ts`** (`POST /api/contaazul/oauth/disconnect`): apaga a linha de credenciais.

---

## 4. Cliente Conta Azul (helper server-only)

`src/lib/conta-azul/client.server.ts`:

- `getValidAccessToken()` — lê tokens do banco; se `expires_at` está perto, faz refresh chamando o token endpoint e atualiza a tabela.
- `caFetch(path, options)` — wrapper de `fetch` para `https://api.contaazul.com/v1{path}` com o Bearer atualizado, paginação automática, retry em 401/429.
- Funções específicas: `listPlanoContas()`, `listCentrosCusto()`, `listContasPagar(from, to)`, `listContasReceber(from, to)`, `listExtrato(from, to)`.

Tudo lê `process.env.CONTA_AZUL_CLIENT_ID/SECRET` dentro do handler.

---

## 5. Server functions de sincronização

`src/lib/conta-azul/sync.functions.ts` (todas com `requireSupabaseAuth`, exigem admin do módulo financeiro):

- `getConnectionStatus()` — retorna `{ connected, connectedAt, lastSyncByResource }`.
- `syncPlanoContas()`, `syncCentrosCusto()`, `syncContasPagar({ from, to })`, `syncContasReceber({ from, to })`, `syncExtrato({ from, to })` — fazem upsert por `external_id` nas tabelas locais e gravam em `ca_sync_log`.
- `syncTudo({ from, to })` — orquestra todas as anteriores em sequência.

---

## 6. UI no módulo Financeiro

Nova sub-aba **"Conta Azul"** no AppSidebar (`/financeiro/conta-azul`) e nova rota `src/routes/financeiro.conta-azul.tsx`:

- **Cartão de Conexão**:
  - Se não conectado: botão **"Conectar Conta Azul"** (abre `/api/contaazul/oauth/start`).
  - Se conectado: data da conexão, botão **"Desconectar"**, e botão **"Sincronizar agora"** (com filtro de período padrão últimos 90 dias).
- **Tabela de logs** das últimas sincronizações (recurso, data, qtd, status).

Nova sub-aba **"Dashboards Financeiros"** (`/financeiro/dashboards`) com cards/gráficos (Recharts) consumindo as tabelas `ca_*`:

- KPIs: total a pagar em aberto, total a receber em aberto, saldo previsto do mês, atrasados.
- Gráfico **fluxo de caixa** (linha): pagamentos vs recebimentos por mês.
- **Top categorias de despesa** (barras, agrupando por `plano_contas.nome`).
- **Despesas por centro de custo** (barras).
- **Extrato consolidado** (tabela paginada com filtro de período).

Esses dashboards substituem progressivamente o Power BI.

---

## 7. Sincronização automática (opcional, segunda etapa)

Inicialmente o sync é **manual** (botão na UI). Em uma segunda iteração podemos agendar via `pg_cron` chamando uma rota `/api/public/contaazul/cron-sync` protegida por header secreto. Fica fora deste primeiro plano para reduzir escopo.

---

## 8. Sidebar e permissões

- Em `src/components/AppSidebar.tsx`, adicionar 2 itens no grupo **Financeiro**:
  - "Dashboards" (`/financeiro/dashboards`)
  - "Conta Azul" (`/financeiro/conta-azul`)
- Ambos restritos ao módulo `financeiro`. O botão **Conectar/Desconectar** só aparece para `isModuleAdmin("financeiro")`.

---

## Detalhes técnicos

- **Endpoints do Conta Azul** que vamos consumir (confirmados na doc pública `developers.contaazul.com`):
  - `GET /v1/plan-of-accounts`
  - `GET /v1/cost-centers`
  - `GET /v1/financial-events?type=PAYABLE&due_date_from=...&due_date_to=...`
  - `GET /v1/financial-events?type=RECEIVABLE&...`
  - `GET /v1/bank-statements?from=...&to=...`
  - OAuth: `https://api.contaazul.com/auth/authorize` + `https://api.contaazul.com/oauth2/token`
- Os tokens do Conta Azul têm validade curta (~1h) e refresh token longo — o helper trata refresh automaticamente.
- Toda chamada a `caFetch` é feita em server functions; o `access_token` **nunca** vai pro browser.
- Os dashboards leem do Postgres local (rápido e disponível mesmo se o Conta Azul cair).

---

## Próximos passos imediatos (após você aprovar este plano)

1. Você confirma que **cadastrou as Redirect URIs** acima no app do Conta Azul.
2. Eu peço os secrets `CONTA_AZUL_CLIENT_ID` e `CONTA_AZUL_CLIENT_SECRET`.
3. Crio a migration, o cliente OAuth, os server fns, a tela de conexão e o primeiro dashboard.
4. Você clica em **Conectar Conta Azul**, autoriza no Conta Azul, volta pro app, clica em **Sincronizar agora**, e os dashboards são populados.