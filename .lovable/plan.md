# Recortes de sincronização Conta Azul

Adicionar dois botões dedicados na aba **Financeiro Op → Conta Azul**, que rodam a sincronização completa (plano de contas, centros de custo, contas a pagar, contas a receber e extrato) para um período fixo e, ao final, reprocessam automaticamente os rateios apenas dos lançamentos daquele período.

## UX na página `financeiro-op.conta-azul.tsx`

Novo card **"Recortes rápidos"** abaixo do card de sincronização atual:

- **Botão "Sincronizar 2026"** — período fixo 01/01/2026 → 31/12/2026. Sem inputs.
- **Bloco "Histórico (antes de 2026)"** — dois inputs De/Até (default: De = 01/01/2023, Até = 31/12/2025), com validação `to < 2026-01-01`. Botão **"Sincronizar histórico"**.
- Barra de progresso reaproveitando o estado `progress` existente (recurso atual X/5).
- Ao finalizar cada recorte, dispara automaticamente o reprocessamento de rateios **restrito aos external_ids do período**, com contador de lotes já usado hoje.

## Backend

### 1. Novo endpoint `POST /api/contaazul/sync-recorte`
Body: `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` (valida `from <= to`).
- Chama `syncTudo(from, to, { incremental: false })` — que já roda os 5 recursos em sequência.
- Retorna `{ resultados, external_ids_pagar, external_ids_receber }` para o cliente poder pedir o reprocesso em lotes.

Alternativa mais simples e preferida: manter o loop atual no client (que já mostra progresso por recurso) e apenas garantir que o botão passe as datas fixas certas. Nesse caso não precisa de endpoint novo — só de nova função no client que chama `/api/contaazul/sync` para cada recurso com `modo: "completo"` e as datas do recorte.

### 2. Endpoint `reprocessar-rateios` — novo modo `periodo`
Em `src/routes/api/contaazul/reprocessar-rateios.ts` e `reprocessarRateios` em `sync.server.ts`:
- Aceitar `{ modo: "periodo", from, to, limite }`.
- `listarCandidatos` filtra `ca_contas_pagar` / `ca_contas_receber` por `data_vencimento BETWEEN from AND to` (mesma coluna que a Análise Detalhada usa em regime de competência), ordenado por `detalhe_synced_at ASC NULLS FIRST`.
- Reaproveita a lógica de reescalonamento de fatias já existente (`buildRateios` + `finalizarFatias`).

### 3. Client — orquestração
Nova função `handleRecorte(from, to)` em `financeiro-op.conta-azul.tsx`:
1. Loop dos 5 recursos chamando `/api/contaazul/sync` com `modo: "completo"` (reaproveita `handleSync`, extraindo a lógica em função parametrizada por datas).
2. Após concluído, chama `/api/contaazul/reprocessar-rateios` com `{ modo: "periodo", from, to, limite: 40 }` em loop até `concluido: true` (mesma proteção de 200 lotes já existente).
3. Toast final com totais: registros sincronizados + rateios corrigidos.

## Correção dos rateios
A lógica de rateio correta já existe (`buildRateios` + `finalizarFatias`, que rescala pelo `valor_parcela / soma_rateios_contrato` e valida tolerância de R$ 0,01). O que muda: garantir que **todo lançamento do recorte passe pelo reprocesso**, não só suspeitos. É isso que o modo `periodo` acima faz — força reprocesso completo dentro da janela sincronizada, usando o token OAuth atual para buscar `/financeiro/eventos-financeiros/parcelas/{id}` de cada lançamento.

## Detalhes técnicos

- Datas 2026 hard-coded como constantes no componente (`RECORTE_2026 = { from: "2026-01-01", to: "2026-12-31" }`).
- Input do histórico usa `<Input type="date" max="2025-12-31">`.
- Reaproveita `busy`, `progress`, `reprocProgress`, `reprocTotals` já existentes — sem novo estado global.
- Sem migração de schema.
- Sem alteração no cron / D-1 / job histórico existente (`ca_sync_jobs`) — os recortes rodam sob demanda, síncronos, do lado do usuário.

## Arquivos afetados
- `src/routes/financeiro-op.conta-azul.tsx` — novo card, `handleRecorte`, refactor pequeno do `handleSync` para aceitar `{ from, to }`.
- `src/routes/api/contaazul/reprocessar-rateios.ts` — aceitar novo modo `periodo` no schema Zod.
- `src/lib/conta-azul/sync.server.ts` — `reprocessarRateios` e `listarCandidatos` aceitando filtro por `from/to`.
