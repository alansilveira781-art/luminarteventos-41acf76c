## Causa raiz

Investiguei `src/lib/conta-azul/sync.server.ts` (`reprocessarRateios`) e o loop no `financeiro-op.conta-azul.tsx`. Há três problemas combinados:

### 1. "Reprocessar tudo" reprocessa os mesmos itens indefinidamente

O filtro que "pula itens já feitos" compara `detalhe_synced_at >= inicioIso`, mas `inicioIso` é o instante em que **a chamada HTTP atual** começou. Cada lote é uma requisição independente, então:

- Lote 1: `inicioIso = T1`. Processa itens A..J e grava `detalhe_synced_at = T1'` (pouco após T1).
- Lote 2: `inicioIso = T2 > T1'`. O filtro `>= T2` não encontra nada → nenhum item é pulado → a mesma lista sai ordenada e o `.slice(0, 100)` pega **os mesmos A..J**.

O loop no cliente chama até 200 lotes achando que está progredindo, mas backend só recicla os primeiros 100 candidatos. Por isso o botão "parece não fazer nada" — o `restantes` nunca chega a zero para os últimos itens da fila.

### 2. Lentidão excessiva

Cada lote:
- Faz 2 varreduras completas de `ca_lancamento_rateios` (uma por tipo) via paginação de 1000 em 1000, só para listar candidatos.
- Aguarda **400 ms fixos entre cada item** (100 itens = 40 s só em `sleep`, além do fetch da Conta Azul e das escritas).

O Worker do Cloudflare tem orçamento apertado de wall-clock; com 100 itens o lote frequentemente estoura o tempo, o cliente vê erro (ou resposta vazia) e o loop "morre" — daí "às vezes não reprocessa nada".

### 3. "Somente suspeitos" sofre do mesmo delay

Cada item leva ~1,5 s (fetch + delay + DB). Mesmo quando a lista é pequena, o feedback visual demora e alguns itens falham por timeout individual sem retry.

---

## Correção (apenas em `src/lib/conta-azul/sync.server.ts` e `src/routes/financeiro-op.conta-azul.tsx`)

### Backend — `reprocessarRateios`

1. **Ordenar candidatos por `detalhe_synced_at ASC NULLS FIRST`** (via join com `ca_contas_pagar/receber`). Assim itens nunca processados vêm primeiro; os processados vão para o fim da fila naturalmente, sem depender de comparação com `inicioIso`. Remover o bloco de "jaFeitos" atual.
2. **Substituir `scanAll` (candidatos rateados)** por uma leitura que retorne `lancamento_external_id`s com `count(*) >= 2` (agrupamento em memória continua ok, mas paginado só até encontrar `limite * 3` candidatos ainda "frescos" para reduzir I/O).
3. **Orçamento de tempo por chamada**: parar o `for` quando `Date.now() - inicioMs > 20 000 ms`, retornando `concluido=false` e `restantes` real. Assim o Worker nunca estoura; o loop do cliente segue o ritmo.
4. **Reduzir `sleep` entre itens de 400 ms para 120 ms** e envolver o `caFetch` em 1 retry com backoff curto (300 ms) em caso de 429/5xx, para não perder o item.
5. Manter comportamento seguro atual (`buildRateios` retornando `null` não apaga rateios existentes).

### Frontend — `handleReprocessarRateios`

1. Reduzir `limite` enviado de 100 para **40** por lote (compatível com o novo orçamento de 20 s do backend, reduz risco de timeout do fetch do navegador).
2. Continuar loop enquanto `!concluido`, mas **parar automaticamente se um lote retornar `tentados === 0`** (proteção adicional).
3. Mostrar no toast quando o loop parou por atingir o limite de 200 lotes de segurança para o usuário poder clicar "Continuar".

## Verificação

- Clicar em **Reprocessar tudo**: cada lote leva ~15 s, `corrigidos` acumulado sobe monotonicamente, `restantes` cai até 0 e o toast final anuncia conclusão.
- Clicar em **Somente suspeitos** com 2 candidatos: conclui em poucos segundos sem timeout.
- Log em `ca_sync_log` mostra `dur` <20 s por lote e itens diferentes em lotes sucessivos (não mais o mesmo ID repetido).
