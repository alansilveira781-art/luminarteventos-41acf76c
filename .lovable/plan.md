## Objetivo

Em `src/lib/conta-azul/sync.server.ts`, garantir que exclusões feitas no Conta Azul sejam refletidas no banco de forma segura para: (a) centros de custo e (b) lançamentos de pagar/receber (incluindo transferências, que são apenas lançamentos comuns marcados por `isTransferencia`).

Alterações apenas em `sync.server.ts`. Nada de UI, mapeamento, rateios ou modo incremental é tocado.

## 1. `syncCentrosCusto` — apagar centros excluídos

Após o `upsertBatched` existente (linha ~132):

- Monta `activeIds = new Set(items.map(it => String(it.id ?? it.uuid)))`.
- **Guarda**: só executa a remoção se `items.length > 0`. Se a API retornou vazio, não apaga nada (evita zerar a tabela por erro/instabilidade da API).
- Lê `external_id` de `ca_centros_custo`, calcula `toDelete = existentes.filter(id => !activeIds.has(id))`.
- Apaga em chunks de 500 via `.in("external_id", chunk)`.
- Registra em `ca_sync_log` um evento `recurso: "reconciliacao_centros_custo"`, `status: "ok"`, `qtd_registros: n`, `mensagem` com os primeiros IDs (padrão dos logs de pagar/receber). Só grava se `n > 0`.
- Se algo falhar dentro do bloco, grava um `status: "erro"` correspondente e segue — não quebra o `syncCentrosCusto` original.

O `logFinish` do recurso `centros_custo` continua como está.

## 2. `reconciliarExclusoes` (pagar/receber) — guarda de segurança

A função já é chamada apenas quando `!incremental` em `syncContasPagar` / `syncContasReceber` (linhas 715 e 784) — esse comportamento fica como está e é confirmado.

Dentro de `reconciliarExclusoes` (linha ~616), antes do `select` em `existentes`:

- Se `activeIds.size === 0`, **aborta** sem apagar nada e lança um erro do tipo `"reconciliação abortada: API retornou 0 itens no período — possível instabilidade"`. O `try/catch` já existente nos chamadores (linhas 731 e 800) grava esse aviso em `ca_sync_log` com `status: "erro"` — que é exatamente o log de auditoria pedido.

O log de auditoria de remoção (quantos foram removidos + primeiros IDs) já existe hoje nos dois chamadores e é mantido.

## Fora de escopo

- Modo incremental permanece intocado (só insere/atualiza o delta).
- Nenhuma mudança em mapeamento, rateios, filtros de data, transferências (que já são cobertas por pagar/receber) ou em qualquer outro recurso.
