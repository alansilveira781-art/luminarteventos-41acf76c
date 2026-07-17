## Diagnóstico

A **conexão OAuth está saudável** — o token do Conta Azul foi refrescado hoje às 10:58 UTC (`conta_azul_credentials.updated_at`). O problema não é autenticação.

Analisando `ca_sync_log`, na sua última tentativa (10:58 de hoje) o padrão foi:

| Recurso | Resultado |
|---|---|
| `plano_contas` | ✅ 255 registros |
| `centros_custo` | ✅ 466 registros |
| `contas_pagar` (2026-01-01 → 2027-12-31) | ⚠️ **em_andamento sem `finished_at`** — o processo morreu no meio |
| `contas_receber` / `extrato` | ❌ nunca chegaram a rodar (o loop no cliente parou antes) |

Isso já aconteceu antes (16/07 21:24 idêntico) e é uma **assinatura clara de timeout do server function**. A causa está em `syncContasPagar` / `syncContasReceber`:

- A listagem `/financeiro/eventos-financeiros` da API v2 do Conta Azul **não traz `centros_de_custo` nem `categorias`** para a maioria dos lançamentos.
- Para não perder rateio/centro no DRE, o código enriquece cada item chamando `/financeiro/eventos-financeiros/parcelas/{id}` (função `enrichItemsWithDetail`).
- O Conta Azul rate-limita esse endpoint agressivamente, então o código usa concorrência 2 com retry/backoff.
- Com um período grande (dois anos, como o atual), são centenas/milhares de chamadas sequenciais e o server function **estoura o orçamento de wall-time do worker** antes de terminar. Resultado: log fica `em_andamento`, cliente recebe erro/timeout, próximos recursos não rodam.

Rodadas anteriores só passaram porque o período era pequeno (5, 42, 79 lançamentos). A rodada com 2981 registros em 16/07 levou quase 6 minutos e foi um "quase-milagre".

## O que fazer

### 1. Não sincronizar períodos grandes pela tela "Sincronizar agora"
Esse botão foi desenhado para janelas curtas (~90 dias). Para trazer histórico longo (2023 → 2027), **usar o card "Carga histórica"**, que já quebra o período em chunks mensais e é processado 1 mês por tick de cron — exatamente para não estourar timeout.

Ação de UI:
- Adicionar aviso no card **Sincronizar dados** quando o intervalo `from → to` for maior que ~120 dias, orientando o usuário a usar Carga Histórica.
- Opcional: travar o botão nesse caso.

### 2. Tornar `syncContasPagar` / `syncContasReceber` resilientes a timeout
Mesmo em janelas curtas o enrichment pode explodir se houver muitos lançamentos. Ajustes em `src/lib/conta-azul/sync.server.ts`:

- **Time budget interno**: parar o `enrichItemsWithDetail` quando o tempo decorrido passar de ~20s e persistir o que já foi coletado, marcando o log como `ok_parcial` com quantos ficaram sem detalhe.
- **Upsert incremental**: gravar em `ca_contas_pagar` a cada N itens processados (ex.: a cada 200), em vez de esperar o array inteiro. Assim, mesmo se o worker for morto, os dados já sincronizados ficam salvos.
- **Fechar o log de forma defensiva** com um `finally` que marca `erro` + mensagem "timeout provável" quando o handler é interrompido — hoje ele fica preso em `em_andamento` e polui o histórico.

### 3. Reprocessar o que ficou pendente
Depois dos ajustes:
1. Marcar o log preso (`contas_pagar` 10:58) como `erro` manualmente para limpar.
2. Rodar `contas_receber` e `extrato` isoladamente para completar a janela corrente.
3. Enfileirar a janela 2026-01-01 → 2027-12-31 via **Carga Histórica** (chunks mensais).

## Escopo técnico

Arquivos a alterar:
- `src/lib/conta-azul/sync.server.ts` — time budget + upsert incremental + `finally` que registra `erro` no `ca_sync_log`.
- `src/routes/financeiro.conta-azul.tsx` — aviso/limite no card "Sincronizar dados" quando o intervalo for grande, com CTA para o card "Carga histórica".

Sem mudança de schema. Sem mudança em RLS/GRANT. Sem mudança no fluxo OAuth.

## Fora de escopo

- Refatorar o enrichment para lote (a API v2 não expõe endpoint em lote).
- Trocar cron para outra ferramenta.
- Mexer em `syncPlanoContas` / `syncCentrosCusto` / `syncExtrato` (funcionaram).
