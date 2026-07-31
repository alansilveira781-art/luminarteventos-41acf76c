## Diagnóstico (confirmado)

No banco, a COMPRA-243 está correta: duas linhas PIX, parcelamento 2x, uma paga (31/08) e uma em aberto (03/08).

O card não fica amarelo porque as consultas dos quadros **não trazem o campo `forma`**:

- `src/routes/compras.index.tsx` (linha 113): `select("compra_id,valor,parcelamento,data_pagamento,pago,pago_em")`
- `src/routes/financeiro.index.tsx` (linha 101): idem para `demanda_pagamentos`

Sem `forma`, o teste "é PIX?" sempre dá falso, então `parcelado` fica falso e o card nunca recebe o destaque nem os badges.

## O que será feito

1. Incluir `forma` no `select` das duas consultas.
2. Passar `forma` para os objetos de pagamento montados no agrupamento (`pagamentosPorCompra` e equivalente em despesas), para que a regra "PIX + parcelamento maior que 1x" seja avaliada corretamente.

Nenhuma mudança de regra de negócio: continua valendo exatamente o combinado — amarelo só para PIX parcelado com parcela em aberto.

## Verificação

Após o ajuste, conferir no Quadro de Compras que a COMPRA-243 aparece amarela com badge de parcela em aberto, e que cards não-PIX permanecem normais.