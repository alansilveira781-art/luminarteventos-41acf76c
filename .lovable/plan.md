
## Problema

Os lançamentos do evento **46179 – MÉTODO CIS 250 – CURITIBA** existem em `ca_contas_pagar` / `ca_contas_receber`, mas quase todos estão com `centro_custo_external_id = NULL`. Consequência:

- O DRE do evento na Análise Detalhada só encontra o que está em `ca_lancamento_rateios` (rateados) + o que tem centro direto — e a maioria não tem nenhum dos dois.
- Ex.: `HOSPEDAGEM MV MÉTODO CIS CURITIBA` R$ 2.400, `LOCAC MOBILIA METODO CIS CURIT` R$ 17.000, todas as receitas do CIS (2× R$ 140.000 + R$ 35.390), etc.

Causa raiz em `src/lib/conta-azul/sync.server.ts`: a listagem da API v2 do Conta Azul **não** devolve `centros_de_custo` para lançamentos com 1 único centro. Hoje o `enrichItemsWithDetail` chama o endpoint de detalhe **só** quando `isRateado(it)` (≥2 centros ou ≥2 categorias). Lançamentos de 1 centro entram no banco sem centro nenhum.

## Fix

### 1. `src/lib/conta-azul/sync.server.ts`

- Trocar o critério de enriquecimento: chamar o endpoint de detalhe **sempre que o item da listagem não trouxer centro nem categoria completos** — na prática, para todos os itens com `centros_de_custo?.length === 0` ou `categorias?.length === 0` (além dos já rateados). Manter concorrência 5.
- Em `persistRateios`, gerar fatia também para itens com 1 centro (a função `buildRateios` já faz isso quando `centros_de_custo` está presente após enriquecimento). Assim o DRE pode se apoiar 100% em `ca_lancamento_rateios` para agregar por evento, sem depender do campo direto.
- `mapEvento` continua lendo `it.centros_de_custo?.[0]?.id`, que agora estará preenchido pós-enriquecimento — o campo `centro_custo_external_id` da tabela pai também passa a vir correto.

Impacto de performance: hoje o sync mensal só chama detalhe para ~10-20% dos itens; passará a chamar para praticamente todos. Um mês de ~800 lançamentos × ~200ms cada / 5 workers ≈ 30s adicionais por recurso por mês. Aceitável para o cron D-1 e para o histórico em chunks mensais que já existe.

### 2. Reprocessar o evento CIS

Depois do deploy, disparar via `/api/contaazul/historico` um job cobrindo `2026-05-01` → `2026-08-31` (janela do CIS + parcelas futuras do carro). Isso re-baixa esses meses de contas a pagar e a receber com o novo enriquecimento, atualiza `centro_custo_external_id` e recria as fatias em `ca_lancamento_rateios`.

### 3. Validação

Rodar no SQL:

```sql
select 'pagar_rateio' src, count(*), sum(valor)
from ca_lancamento_rateios
where tipo='pagar' and centro_custo_external_id='514fc86e-60d4-11f1-bf1c-6f50526ad2f5'
union all
select 'receber_rateio', count(*), sum(valor)
from ca_lancamento_rateios
where tipo='receber' and centro_custo_external_id='514fc86e-60d4-11f1-bf1c-6f50526ad2f5';
```

Esperado, conforme o extrato enviado:
- Receber ≈ R$ 315.390,00 (3 recebimentos)
- Pagar ≈ R$ 212.000,00 (~14 lançamentos, incluindo as fatias das comissões e do vídeo MAXMIDIAS já rateados)

Depois abrir Financeiro › Dashboard › Análise Detalhada, filtrar o evento CIS e conferir se o DRE bate com o extrato.

## Fora de escopo

- Não altero `calcularDRECaixa` nem outras queries da Análise Detalhada (já corrigidas anteriormente com `fetchPaged`).
- Não mudo as tabelas nem o schema — só a lógica de sincronização.
- Sem re-sync global agora; só a janela do CIS. Um re-sync completo dos últimos 12 meses pode ser rodado depois se você quiser garantir os outros eventos também.
