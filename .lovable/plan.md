
## Diagnóstico (confirmado no banco e nos logs)

Investiguei o caso citado — Comissão MESQUITA 06/2026, ID `9f63a062...`:

- **Lançamento pai** em `ca_contas_pagar`: total R$ 26.550,77 (não R$ 8.199,57; esse deve ser o valor real de uma das fatias).
- **`ca_lancamento_rateios`** para esse ID: 4 fatias, TODAS com valor idêntico R$ 6.637,69 (= 26.550,77 ÷ 4). Ou seja, **divisão igual como fallback**, não o rateio real do Conta Azul.
- **`ca_sync_log`** mostra a causa: a última sync registrou `enrich_timeout_receber` (209/268 lançamentos ficaram sem detalhe) e dezenas de `rateio_sem_valor` para lançamentos a pagar rateados. Quando o enrichment `/parcelas/{id}` falha ou o payload não traz `valor`/`percentual` por centro de custo, `distribuirValores` cai em `total/n` (divisão igual).

Ou seja: os rateios no banco estão errados em larga escala porque:
1. **Timeout de enrichment**: o worker do sync está estourando o time budget e pulando o detalhe de muitos lançamentos (fallback = divisão igual).
2. **Payload rateado sem `valor` explícito**: mesmo quando o detalhe vem, o parser cai em divisão igual se a API não trouxer `valor` por CC — precisamos inspecionar o formato real e extrair o valor certo (o probe `probe_rateio_detalhe_*` já loga uma amostra do payload; vou usá-la para ajustar o parser).

## O que a plano faz

Só mexer no pipeline de rateio — `src/lib/conta-azul/sync.server.ts` — e nada na UI. Sem alterar cálculo do dashboard: quando os rateios vierem corretos, a Análise Detalhada e o Relatório de Análises passam a mostrar os valores reais automaticamente.

### 1. Inspecionar o payload real de `/parcelas/{id}`

Ler o último `probe_rateio_detalhe_pagar` / `_receber` em `ca_sync_log` para ver exatamente como o Conta Azul envia o rateio hoje (chave, aninhamento, campo de valor/percentual). Ajustar `buildRateios` para reconhecer esse formato exato antes de cair em qualquer fallback.

### 2. Corrigir `buildRateios` para nunca fazer divisão igual quando o pai tem centros distintos

- No formato v2 (`evento.rateio[]`), tratar corretamente os casos em que `rateio_centro_custo[]` traz apenas percentual (`percentual`/`porcentagem`) — hoje só olha `c.valor`.
- Se um grupo tiver 1 CC, usar `valorGrupo` (não o total do lançamento).
- Se detectarmos `pairs` com `centros_de_custo` distintos mas sem valor nem percentual (caso `rateio_sem_valor`), **não gravar rateios falsos**: gravar 1 linha por CC com `valor = NULL` (ou pular e deixar só o pai) e logar para inspeção. Melhor um valor faltando visível do que um valor inventado.

### 3. Reduzir o timeout de enrichment para deixar de perder detalhe

O log mostra 209/268 receber pulados por deadline. Duas mudanças:
- **Só enriquecer itens realmente rateados** (`isRateado`) — hoje `needsDetail` também enriquece itens de 1 CC só para preencher `centro_custo_external_id`, o que compete pela mesma cota da API. Para 1 CC, usar direto o que veio na listagem.
- **Cache de detalhe entre execuções**: guardar em `ca_sync_state` (ou nova coluna em `ca_contas_pagar/receber`) um `detalhe_hash` para pular o `/parcelas/{id}` quando o lançamento não mudou desde a última busca bem-sucedida. Assim o incremental para de rebuscar tudo.
- Manter o throttle atual (respeita 429), mas com menos itens na fila o mesmo budget cobre tudo.

### 4. Reprocessamento pontual dos lançamentos afetados

Depois do fix, criar um endpoint interno (server function chamada da rota `/api/contaazul/reprocessar-falhas` que já existe) que:
- Lista `lancamento_external_id` distintos em `ca_lancamento_rateios` que ficaram com valor uniforme entre >=2 fatias (heurística de "divisão igual") **e** os IDs presentes em `ca_sync_log.recurso IN ('rateio_sem_valor','enrich_timeout_*')`.
- Reenriquece só esses via `/parcelas/{id}` e regrava as fatias.
- Retorna um resumo (quantos reprocessados, quantos ainda sem valor).

Assim não precisa refazer sync inteiro; só corrigir os quebrados.

### 5. Validação

Depois de rodar o reprocessamento:
- Reconferir o ID `9f63a062...`: 4 fatias devem somar 26.550,77 com valores heterogêneos (uma delas ≈ R$ 8.199,57, como o usuário viu no Conta Azul).
- Rodar `SELECT lancamento_external_id, COUNT(*), COUNT(DISTINCT valor) FROM ca_lancamento_rateios GROUP BY 1 HAVING COUNT(*) >= 2 AND COUNT(DISTINCT valor) = 1` — a lista deve encolher drasticamente (só permanecendo casos legítimos de rateio igual, se houver).
- Abrir a Análise Detalhada no dashboard e confirmar visualmente o valor de Comissões.

## Arquivos tocados

- `src/lib/conta-azul/sync.server.ts` — `buildRateios`, `distribuirValores`, `needsDetail`, `enrichItemsWithDetail` (+ possivelmente cache de detalhe).
- `src/routes/api/contaazul/reprocessar-falhas.ts` — novo modo "rateios_incorretos" com a heurística acima.
- Migração pequena: coluna `detalhe_hash` (ou `detalhe_synced_at`) em `ca_contas_pagar` / `ca_contas_receber` para o cache de enrichment.

Nenhuma mudança na UI da Análise Detalhada — os valores corretos aparecem automaticamente assim que os rateios forem regravados.

## Pergunta antes de implementar

Quer que eu:
- **(A)** faça o fix do parser + reprocessamento (rápido, resolve o que está errado agora), ou
- **(B)** faça (A) + o cache de enrichment (evita o problema voltar a acontecer em cargas grandes)?

Recomendo **B**, mas leva um passo a mais (mini migração).
