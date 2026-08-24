# Regime de caixa: exigir data de pagamento

Hoje, no regime de caixa, um lançamento com status "pago" mas **sem data de pagamento** é considerado usando a data de vencimento como substituta. Isso faz o mesmo lançamento aparecer em um lugar e não em outro (exemplo confirmado: "DC - Ajuda de Custo" de R$ 900,00, vencimento 01/07/2026, sem data de pagamento e sem centro de custo — soma bruta 5.794,54 vs. demonstrativo 4.894,54).

## Regra nova

No regime de caixa (visão "realizado"), o lançamento só entra no período se tiver **data de pagamento** preenchida. Sem data de pagamento, fica de fora — em todos os cálculos e telas.

Regime de competência e visão "projetado" continuam iguais (data de vencimento).

## Onde muda

- `src/lib/conta-azul/dre.ts`
  - `passaVisao` (visão "realizado"): usar apenas `data_pagamento`, sem cair para `data_vencimento`.
  - `calcularDRECaixa` (regime "caixa"): mesma regra no filtro de período.
  - Lançamentos de transferência: usar `data_pagamento` na coluna de data quando a visão for "realizado".
- `src/components/financeiro/ContaAzulDashboard.tsx`: a data de referência usada na listagem/agrupamento passa a seguir a mesma regra, para que a lista bata com os totais.

## Efeito esperado

Painel Financeiro, DRE, Análise Detalhada, gráfico "Custo de operação x Receita" e as listas de lançamentos passam a mostrar exatamente os mesmos valores. Alguns totais mensais vão diminuir (os lançamentos sem data de pagamento saem do mês do vencimento) até que a data seja preenchida no Conta Azul e sincronizada.
