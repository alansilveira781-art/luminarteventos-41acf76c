# Corrigir Receita Bruta e pagamentos do Dashboard Financeiro

## Resultado esperado

O relatório passará a retratar o caixa real do mês selecionado:

- **Receita Bruta**: soma somente das seis categorias do plano de contas iniciadas por `RB -`, incluindo todas as categorias mostradas na imagem.
- **Recebido** e **Pago**: soma das baixas efetivamente ocorridas no mês, pela data do pagamento, mesmo quando o vencimento pertence a outro mês.
- Outras entradas (`OR`) e receitas financeiras (`RF`) continuarão nas linhas próprias do DRE e não serão misturadas à Receita Bruta.
- Lançamentos em aberto continuarão usando o vencimento para “A receber” e “A pagar”.

## Diagnóstico confirmado

- As seis categorias `RB` estão cadastradas no plano de contas sincronizado e a estrutura do DRE contém o prefixo `RB`.
- O dashboard busca contas primeiro pelo vencimento e só depois aplica a data de pagamento. Assim, pagamentos do mês com vencimento fora dele não chegam ao cálculo.
- O código atual mistura três critérios: vencimento, `data_pagamento` do título e baixas individuais, causando divergência entre cards, DRE e detalhamento.
- Em agosto/2026, a base contém valores diferentes entre os títulos e as baixas persistidas; portanto, além do cálculo, será necessário reconciliar o sincronismo antes de validar os totais finais.

## Implementação

1. **Usar as baixas como fonte do realizado**
   - Carregar `ca_lancamento_baixas` pela `data_baixa` do período, sem filtrar previamente os títulos por vencimento.
   - Buscar os respectivos títulos de contas a receber e pagar pelo identificador do lançamento.
   - Somar o valor real de cada baixa, suportando pagamentos parciais e múltiplas baixas do mesmo título.

2. **Classificar corretamente todas as receitas**
   - Relacionar cada baixa ao plano de contas sincronizado.
   - Quando houver rateio por categoria, distribuir proporcionalmente o valor efetivamente baixado entre as fatias do lançamento, sem duplicar o total.
   - Quando não houver rateio, usar a categoria do título como fallback.
   - Somar em Receita Bruta somente categorias cujo prefixo normalizado seja `RB`; manter `OR`, `RF` e demais grupos separados.
   - Exibir claramente lançamentos sem categoria ou sem prefixo reconhecido, em vez de descartá-los silenciosamente.

3. **Unificar os cálculos das telas**
   - Centralizar em `src/lib/conta-azul/dre.ts` a regra de caixa baseada em baixas.
   - Aplicar a mesma fonte no Dashboard Financeiro e no Painel, evitando números diferentes entre as duas telas.
   - Manter a análise por competência como regra separada, sem alterar seus lançamentos por vencimento.

4. **Completar e proteger o sincronismo**
   - Reprocessar títulos pagos que ainda não tenham todas as baixas persistidas.
   - Garantir que o cache de detalhes só considere um título liquidado como completo quando suas baixas estiverem gravadas.
   - Preservar categoria, centro de custo e valor total do título durante o enriquecimento.
   - Registrar uma conferência entre valor liquidado informado pelo título e soma das baixas, destacando diferenças para reprocessamento.

5. **Validar com o plano de contas e o Conta Azul**
   - Conferir Receita Bruta por cada uma das seis categorias `RB` da imagem.
   - Conferir Recebido e Pago por dia e por lançamento, incluindo vencimentos de outros meses.
   - Confirmar que a soma das categorias coincide com o total da Receita Bruta e que a soma das baixas coincide com os cards de Recebido/Pago.
   - Validar agosto/2026 no Dashboard Financeiro e no Painel após o reprocessamento.

## Detalhes técnicos

- Arquivos principais: `src/lib/conta-azul/dre.ts`, `src/components/financeiro/ContaAzulDashboard.tsx`, `src/routes/painel.tsx` e `src/lib/conta-azul/sync.server.ts`.
- Fonte do realizado: `ca_lancamento_baixas.data_baixa` + valor da baixa.
- Classificação: `ca_plano_contas` e, quando aplicável, `ca_lancamento_rateios`.
- Nenhuma categoria será codificada manualmente: o agrupamento continuará acompanhando o plano de contas sincronizado pelo prefixo configurado na estrutura do DRE.
