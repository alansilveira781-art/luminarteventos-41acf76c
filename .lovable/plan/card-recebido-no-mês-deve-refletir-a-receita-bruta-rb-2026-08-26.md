# Card "Recebido no mês" deve refletir a Receita Bruta (RB)

## Resultado esperado

O card **"Recebido no mês"** passa a exibir o mesmo valor do card **"Receita Bruta"**, ou seja, somente as baixas classificadas nas categorias `RB`. A comparação com faturamento e o cálculo do saldo a receber seguem esse novo valor.

## Escopo

Ajuste no bloco **Faturamento (Vendas) x Recebimento** da aba **Painel Financeiro** (`src/components/financeiro/ContaAzulDashboard.tsx`).
Se o mesmo ajuste for necessário no **Painel Executivo** (`/painel`), será incluído como passo adicional.

## Implementação

1. Usar o total RB já calculado no comparativo de faturamento
   - Em `src/components/financeiro/ContaAzulDashboard.tsx`, a chamada `compararFaturamento(...)` usa hoje `caixaAtual.recebido` e `caixaAnterior.recebido` (todas as entradas do mês).
   - Substituir por `rb` (mês atual) e `rbAnt` (mês anterior), que já são os totais do grupo `RB` no DRE.

2. Ajustar o rótulo do card
   - Alterar o subtítulo de "Total realizado no caixa" para "Receita Bruta recebida no mês" para deixar claro o novo critério.

3. Manter o PDF alinhado
   - A linha "Recebido no período (Receita Bruta)" do PDF usa `comparativo.recebido`; após a mudança do comparativo, ela refletirá o valor RB automaticamente.

## Detalhes técnicos

- `rb` e `rbAnt` já consideram rateios (`ca_lancamento_rateios`) e baixas (`ca_lancamento_baixas`), garantindo que o valor seja proporcional e pelo regime de caixa.
- Não haverá mudança no cálculo do DRE, no gráfico de custo de operação nem no saldo de caixa geral (`calcularIndicadoresCaixa` continua com o valor total de entradas para outros usos).
