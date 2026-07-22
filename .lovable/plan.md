## Problema

Na Análise Detalhada, ao clicar em "reprocessar" numa categoria com lançamento que foi **excluído no Conta Azul**, o app tenta buscar o detalhe em `/financeiro/eventos-financeiros/parcelas/{id}` → API responde **404** → `caFetch` lança erro → `reprocessarRateios` conta como **falha** e mantém o lançamento local intacto. Resultado: toast "Falha ao reprocessar (3 erros)" e os lançamentos continuam aparecendo no dashboard.

## Correção

### 1. `src/lib/conta-azul/sync.server.ts` — `reprocessarRateios`

- Detectar 404 no `catch` (mensagem `Conta Azul API ... [404]`).
- Quando 404: **remover** o lançamento local — `delete` em `ca_lancamento_rateios` e em `ca_contas_pagar` / `ca_contas_receber` para aquele `external_id`.
- Contabilizar como `removidos` (novo contador), não como `falhas`.
- Incluir `removidos` no retorno e no `ca_sync_log`.

### 2. `src/components/financeiro/ContaAzulDashboard.tsx` — `CategoryReprocessButton`

- Ler `removidos` da resposta.
- Toast passa a considerar `removidos`: ex. "Rateios: X corrigidos · Y removidos" ou "Y lançamentos removidos (excluídos no Conta Azul)".
- Só reportar `falhas` quando forem falhas reais (não-404).
- Após concluir, invalidar as queries dos lançamentos (o `onDone` já dispara `refetch`, verificar que cobre a lista de lançamentos exibida).

## Fora de escopo

- Não alteramos a lógica geral de sync (`syncIncremental`), que já ignora ausências. Só o caminho de reprocesso manual passa a limpar registros órfãos.
