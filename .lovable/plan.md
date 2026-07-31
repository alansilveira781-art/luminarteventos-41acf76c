## Problema

No card `COMPRA-252` (forma **CASA BLANCA**, sem PIX) aparece o destaque amarelo e o badge "Parcelado · 1 em aberto". Isso acontece porque `statusPagamentos` em `src/lib/pagamentos.ts` marca `parcelado: true` em três situações: duas datas distintas, parcelamento maior que 1x **ou** simplesmente mais de uma forma de pagamento — sem checar se a forma é PIX.

## O que será feito

O card só fica amarelo e só mostra os badges de parcelamento quando existir pelo menos uma forma **PIX com parcelamento maior que 1x**. Qualquer outra forma (cartão, boleto, dinheiro), mesmo parcelada ou com várias formas, volta a ser um card normal, sem cor e sem badges.

Isso vale igualmente para o Quadro de Compras e o Quadro de Despesas.

## Detalhe técnico

- `src/lib/pagamentos.ts`: em `statusPagamentos`, trocar a condição de `parcelado` por `linhas.some(exigeControleParcelas)` (PIX + parcelas > 1). Os demais campos (total pago, próxima data, vencidas) continuam calculados igual, mas passam a considerar apenas as linhas PIX parceladas para "parcelas em aberto"/"vencidas" exibidas no card.
- `src/routes/compras.index.tsx` e `src/routes/financeiro.index.tsx` não mudam de lógica: já derivam `parceladoPendente` de `pagto.parcelado`, que passa a ser correto.
