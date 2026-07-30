## Objetivo
Deixar o campo de valor total do diálogo de Compras visualmente idêntico ao de Despesas.

## Situação atual
- Despesas (`DemandaDialog.tsx`): rótulo "Valor total (R$)" e uma caixa cinza com borda, valor em negrito à esquerda e a legenda "CALCULADO PELOS ITENS" em maiúsculas discretas à direita.
- Compras (`CompraDialog.tsx`): rótulo "Valor total (calculado)" e apenas o valor em texto simples, sem caixa nem legenda.

## Mudança
Em `src/components/CompraDialog.tsx` (bloco do valor total, ~linha 560):
- Trocar o rótulo para "Valor total (R$)".
- Substituir a exibição simples pela mesma caixa usada em Despesas: `flex h-10 items-center justify-between rounded-md border border-input bg-muted/50 px-3 text-sm`, com o valor em `font-semibold tabular-nums` e a legenda "calculado pelos itens" em `text-[10px] uppercase tracking-wider text-muted-foreground`.

Somente alteração visual — o cálculo do total pelos itens permanece igual.
