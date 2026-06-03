# Dashboard Financeiro + Sync Incremental (Conta Azul)

A última sincronização rodou 100% OK (847 contas a pagar, 72 a receber, 253 categorias, 440 centros de custo, 39 contas financeiras). Agora vamos construir os 3 painéis e o agendamento.

## 1. Nova seção "Financeiro" no Dashboard

Adicionar uma 3ª aba no `financeiro/dashboard` (ao lado de "Despesas" e "Uber") chamada **"Conta Azul"**, dividida em 3 sub-abas, espelhando os prints:

### 1a. Painel Financeiro (visão geral)
- Filtros: **Ano** e **Mês** (Todos por padrão).
- 5 KPIs no topo: **Receita Bruta**, **Pot. de Vendas**, **Despesas**, **Custos**, **Lucro** — cada um com variação % vs. ano anterior (LY).
- À esquerda: tabela **Demonstrativo (DRE)** agrupada pelo plano de contas (Receita Bruta → categorias filhas; Deduções; Receita Líquida; Custos Variáveis; Despesas; Lucro), com Valores e % sobre Receita.
- À direita: tabela **Movimentações** (data, fornecedor/cliente, descrição, valor) com totalizador.

### 1b. Análise Detalhada (por Evento/Projeto)
- Filtros: **Evento/Projeto** (= centro de custo da Conta Azul) e **Ano**.
- Mesmos 5 KPIs, calculados apenas para o centro de custo escolhido.
- Demonstrativo (Resultados + A.V. %) e lista de movimentações do projeto.

### 1c. Fluxo de Caixa
- Filtros: **Ano** e **Mês**.
- 3 KPIs: **A Receber**, **A Pagar**, **Geração de Caixa** (Receber − Pagar).
- Tabela de **Contas a Receber/Pagar** (toggle), com data, fornecedor/cliente, categoria.
- **Saldo Bancos**: barras horizontais por conta financeira (verde positivo, vermelho negativo) — usa `ca_extrato` (saldo atual por conta).
- **Gráfico Fluxo de Caixa**: barras verdes (receber) + vermelhas (pagar) por semana/mês + linha azul de saldo acumulado.

Todos os dados vêm das tabelas já populadas: `ca_contas_pagar`, `ca_contas_receber`, `ca_plano_contas`, `ca_centros_custo`, `ca_extrato`.

## 2. Sync incremental D-1 + agendado

Hoje cada sync re-baixa todo o período pedido. Vamos:

1. **Registrar janelas sincronizadas** numa nova tabela `ca_sync_state` (uma linha por recurso com `last_synced_from`, `last_synced_to`, `last_run_at`). A próxima execução automática sempre sincroniza de **D−1 até hoje** e atualiza o cursor (upsert por `external_id` já está implementado, então não duplica).
2. **Carga histórica única**: botão "Sincronizar histórico (2023 → ontem)" na aba Conta Azul que faz uma varredura inicial em blocos mensais para não estourar o limite da API.
3. **Agendamento automático**: nova tabela `ca_sync_schedule` com até 3 horários diários (HH:MM, fuso América/Fortaleza) editáveis na aba Conta Azul. Um `pg_cron` minutal chama uma rota pública `/api/public/contaazul/cron` que verifica se algum horário bate com o "agora" e, em caso afirmativo, dispara o sync D-1 de todos os recursos.

## 3. Mudanças na aba "Conta Azul" (configuração)

Adicionar, abaixo dos botões atuais:
- Card **"Sincronização automática"**: 3 inputs de horário (default 06:00, 12:00, 18:00) + toggle ativo/inativo + botão Salvar.
- Card **"Carga histórica"**: date pickers (default 2023-01-01 → ontem) + botão "Rodar agora" (em background, com barra de progresso por mês).
- Card **"Última sincronização"**: mostra `ca_sync_state` (recurso, janela, qtd, quando).

## Detalhes técnicos

- **Migrations** (3 tabelas novas, todas com RLS para admins do módulo `financeiro` e GRANTs):
  - `ca_sync_state(recurso PK, last_synced_from, last_synced_to, last_run_at)`
  - `ca_sync_schedule(id, horario time, ativo bool, created_at)` — máx. 3 linhas.
  - `ca_sync_jobs(id, tipo, status, from, to, started_at, finished_at, progress jsonb)` para a carga histórica em background.
- **Server fns / rotas**:
  - `syncIncrementalD1()` em `sync.server.ts` que lê `ca_sync_state`, calcula a janela `[max(last_synced_to, hoje−1), hoje]` e chama os syncs existentes.
  - `POST /api/contaazul/historico` → enfileira job, processa mês a mês (loop dentro do handler com upsert de progresso).
  - `POST /api/contaazul/schedule` → CRUD dos horários.
  - `POST /api/public/contaazul/cron` → autenticado via `apikey` anon, dispara `syncIncrementalD1()` se o minuto atual coincidir com algum horário ativo. Agendado com `pg_cron` a cada minuto via `pg_net`.
- **Frontend** (sem mudanças de regra de negócio):
  - Novo arquivo `src/components/financeiro/ContaAzulDashboard.tsx` com as 3 sub-abas e componentes auxiliares (`KpiCard`, `DRETable`, `FluxoCaixaChart` usando recharts já instalado).
  - `src/routes/financeiro.dashboard.tsx`: adicionar `TabsTrigger value="contaazul"` e renderizar o componente.
  - `src/routes/financeiro.conta-azul.tsx`: adicionar os 3 cards de configuração e tabela `ca_sync_state`.

## Pontos a confirmar antes de implementar

1. **"Evento/Projeto" = centro de custo da Conta Azul?** É o mapeamento natural, mas se vocês usam um outro campo (ex.: projeto), me confirme.
2. **Mapeamento DRE**: o demonstrativo nos prints usa grupos fixos (Receita Bruta, Deduções, Custos Variáveis, Despesas, Lucro). Vou inferir esses grupos a partir do **tipo** do plano de contas da Conta Azul (`RECEITA`, `DESPESA`, etc.). Se vocês têm uma classificação manual, posso adicionar uma tela de "mapeamento DRE" depois.
3. **Fuso dos horários agendados**: assumo América/Fortaleza (BRT, sem horário de verão). OK?

Posso seguir com essas 3 premissas (responder "ok" ou ajustar). Se aprovar, implemento tudo de uma vez.
