## Diagnóstico confirmado

O payload real do Conta Azul já apareceu nos logs e o campo correto é:

```text
centros_de_custo: [
  { id: "...", nome: "..." }
]
```

Hoje o sync grava `centro_custo_external_id` a partir de `it.centros_custo?.[0]?.id`, mas o payload usa `centros_de_custo`. Por isso a coluna ficou 100% vazia e a Análise Detalhada zera quando filtra por centro de custo.

## Plano de implementação

1. **Corrigir o mapeamento do sync**
   - Em `src/lib/conta-azul/sync.server.ts`, alterar `mapEvento` para preencher `centro_custo_external_id` usando `it.centros_de_custo?.[0]?.id`.
   - Manter fallback para `it.centros_custo?.[0]?.id`, caso alguma resposta antiga use esse formato.
   - Aplicar a correção tanto para contas a pagar quanto para contas a receber, pois ambas usam `mapEvento`.

2. **Remover logs temporários**
   - Remover o bloco `PAYLOAD_CC_DEBUG_PAGAR`.
   - Remover/limpar o diagnóstico temporário que tenta buscar detalhe e gera 404.
   - Deixar o sync sem logs ruidosos depois que o campo real foi identificado.

3. **Manter a Análise Detalhada filtrando no banco**
   - Preservar a lógica atual da aba: selecionar o nome do centro de custo, resolver todos os IDs com o mesmo nome e buscar apenas lançamentos com `centro_custo_external_id in (...)`.
   - Não voltar ao filtro por texto de descrição.
   - Não alterar Painel Financeiro nem Fluxo de Caixa.

4. **Reprocessar dados para popular a coluna**
   - Depois do código corrigido, rodar um sync curto de março/2026 para `contas_pagar` e `contas_receber` para popular o evento MANDARA rapidamente.
   - Confirmar no banco que `centro_custo_external_id` deixou de estar vazio para os lançamentos desse período.
   - Em seguida, se necessário, rodar o sync por períodos maiores para backfill histórico completo.

5. **Validar o evento MANDARA**
   - Verificar no banco quantos lançamentos de pagar/receber passaram a existir para os IDs de centro de custo cujo nome contém `MANDARA`.
   - Validar que a Análise Detalhada exibe entradas e saídas do evento, e que DRE/lista somam apenas lançamentos pagos, preservando `isTransferencia`, sinais e cascata do DRE.

## Resultado esperado

Após a correção e o sync de março/2026, selecionar o evento MANDARA deve trazer os lançamentos vinculados pelo centro de custo real, sem depender da descrição, e carregar em poucos segundos.