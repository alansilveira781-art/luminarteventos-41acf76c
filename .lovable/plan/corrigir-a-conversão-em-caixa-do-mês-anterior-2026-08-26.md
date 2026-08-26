# Corrigir a conversão em caixa do mês anterior

Você está certo: o texto "Em Mai/2026 a conversão em caixa foi de 0,0%" está errado.

## O que está acontecendo

No bloco Faturamento x Recebimento, o valor de recebimento do período anterior que alimenta o texto não é o do mês anterior. Ele vem de um cálculo feito para o mesmo mês do **ano anterior**, e além disso esse cálculo é feito sem os dados de baixas e rateios do período — por isso resulta em zero e a conversão aparece como 0,0%.

O painel já calcula corretamente o mês anterior (Mai/2026) em outro ponto, usado nos textos de Receitas e Custos Variáveis. É esse valor que deveria alimentar a conversão anterior.

## Correção

- Passar a Receita Bruta recebida do **mês anterior** (a que já é calculada com baixas e rateios) como base do comparativo de conversão, em vez do valor do ano anterior.
- O comparativo anual de receita (variação vs. ano anterior nos cards) continua como está.

## Detalhes técnicos

- Arquivo: `src/components/financeiro/ContaAzulDashboard.tsx`.
- Em `compararFaturamento(...)`, trocar o argumento `rbAnt` (derivado de `totaisAnt`, ano-1 e sem baixas/rateios) por `totaisPrev.RB ?? 0`, que vem do `calcularDRECaixa` do período anterior com `prevData.baixas` e `prevData.rateios`.
- Sem mudanças em `painel-analises.ts` nem no banco.
