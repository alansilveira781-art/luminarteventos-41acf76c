## Objetivo
Tornar a sincronização resiliente à cota (429 QuotaViolation), rodando mais devagar e aguardando mais tempo entre tentativas, sem alterar filtros de data, mapeamento ou rateios.

## Alterações

### 1. `src/lib/conta-azul/sync.server.ts` — `enrichItemsWithDetail`
- Alterar `const CONCURRENCY = 2` para `const CONCURRENCY = 1`.
- Adicionar constante no topo do arquivo (junto às demais): `const DETAIL_THROTTLE_MS = 350`.
- No final de cada iteração do `worker` (após o `try/catch` que faz `caFetch(url)`), adicionar `await sleep(DETAIL_THROTTLE_MS)`.
- Usar o `sleep` já existente no módulo (ou importar/definir localmente se ainda não houver — verificar na hora da implementação).

### 2. `src/lib/conta-azul/client.server.ts` — `caFetch`
- Alterar `const MAX_ATTEMPTS = 4` para `const MAX_ATTEMPTS = 6`.
- No bloco `if (RETRY_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS)`:
  - Sem `retry-after`: trocar `1000 * 2 ** (attempt - 1)` por `Math.min(2000 * 2 ** (attempt - 1), 60000)`.
  - Com `retry-after`: trocar o teto de `15000` para `60000` (`Math.min(retryAfter * 1000, 60000)`).
- Manter 401 (refresh) e erros de rede inalterados.

### 3. Continuidade em caso de falha final
- Nenhuma mudança de código necessária: `enrichItemsWithDetail` já captura exceções por item em `detalheFalhas` e prossegue. Confirmar apenas que o comportamento permanece (não abortar o loop).

## Fora de escopo
Filtros de data (vencimento + alteração), mapeamento, rateios, UI, endpoints, migração.