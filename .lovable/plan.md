## Diagnóstico

Checagem direta no banco:

```
select tipo, count(*), count(valor_total) fv, count(valor_unitario) fu from movimentacoes group by tipo;
   tipo    | count | fv  | fu
-----------+-------+-----+-----
 saida     |  1719 |   0 |   0
 devolucao |   150 |   0 |   0
 entrada   |  1535 | 394 | 500
```

Ou seja: **nenhuma saída tem `valor_total` preenchido**. A `AnaliseDetalhada` está lendo `movimentacoes.valor_total` diretamente (linha 666), então soma sempre = 0 e nada aparece. Não é problema de casamento categoria↔plano nem de evento↔centro; é a fonte do valor.

O valor real da saída = `movimentacoes.quantidade × itens.valor_unitario` (custo médio já mantido pelo trigger `apply_custo_medio_entrada` nas entradas). Todas as 1719 saídas têm `item_id` preenchido; `movimentacao_itens` tem só 28 linhas (composites raros).

Também confirmei:
- `ca_centros_custo.nome` começa com o mesmo código do `evento_projeto` (ex: "46158 - …" nos dois lados), então o casamento por prefixo do `centroNeedle` funciona.
- `itens.categoria` usa nomes tipo "CV - ACRILICO" (maiúsculo, sem acento) e `ca_plano_contas.nome` usa "CV - Acrílico". A normalização que apliquei (lowercase + strip acento) casa esses casos; onde não casar, cai no fallback SC (visível como "(?) Sem classificação").

## Correção

Em `AnaliseDetalhada` de `src/components/financeiro/ContaAzulDashboard.tsx`:

1. Trocar o `select` da query `saidasEstoque` para trazer `quantidade` e `itens(categoria, valor_unitario)` em vez de `valor_total`.
2. No `stockAgg`, calcular `valor = quantidade × (itens.valor_unitario ?? 0)`.
3. Também considerar as saídas de composite via `movimentacao_itens` (query adicional só das saídas dessa mov): buscar `movimentacao_itens(quantidade, itens(categoria, valor_unitario))` para as movimentações `tipo='saida'` cujo `item_id` é null (28 registros no total, custo baixíssimo). Somar cada linha à agregação usando o `evento_projeto` da movimentação-pai.
4. Manter o resto igual: casamento por `evento_projeto` × `centroNeedle`, categoria por nome ↔ plano de contas, chave de detalhe = `external_id` do plano (mescla na linha existente), fallback SC quando não casar.

## Escopo

- Só `src/components/financeiro/ContaAzulDashboard.tsx` (componente `AnaliseDetalhada`).
- Nenhuma mudança visual, de UI, layout ou de outras telas.
- Sem migração / sem alteração no `sync.server.ts`.

## Validação

Após o ajuste, selecionar um centro de custo com evento que tenha saídas de estoque (ex.: um dos "46158 - …") e conferir se aparecem valores em Custos Variáveis / Custos Diretos na Análise Detalhada.