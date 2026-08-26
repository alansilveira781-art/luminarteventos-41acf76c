# Corrigir “Custo de operação x Receita”

## Problema confirmado

O gráfico não está aplicando a composição solicitada. Hoje ele soma, além de Potencial de Vendas, Despesas e Custos, também **Deduções da Receita, Despesas Financeiras e Investimentos**. Isso infla especialmente agosto e faz o percentual ultrapassar 100%.

A média também fica artificialmente baixa porque a base de baixas de 2026 está incompleta para pagamentos: fevereiro, março, maio e junho aparecem com receita, mas sem nenhuma saída liquidada. Assim, esses meses entram na média como 0%, produzindo os 10,03% exibidos.

## Ajustes

1. **Aplicar a fórmula correta**
   - Receita: somente `RB — Receita Bruta`.
   - Custo de operação: somente:
     - Potencial de Vendas: `AC + DM + DC`;
     - Custos: `CV + CD + CI`;
     - Despesas: `DS + DA + DT`.
   - Excluir do indicador `DR`, `DF`, `IN`, `OS` e quaisquer subtotais calculados.

2. **Corrigir a média anual**
   - Calcular a média consolidada como `soma dos custos de operação / soma das receitas` dos meses completos, em vez da média simples dos percentuais mensais.
   - Não tratar mês sem baixas de saída reconciliadas como custo zero; sinalizar o mês como incompleto e retirá-lo da média até a reconciliação.
   - Manter agosto visível no gráfico, mas fora da média enquanto ainda for o mês corrente.

3. **Completar o histórico de caixa de 2026**
   - Reconciliar as baixas de contas a pagar mês a mês, independente do vencimento do título.
   - Garantir que cada baixa use o rateio sincronizado para distribuir o valor entre as categorias do DRE.
   - Processar em lotes retomáveis, preservando checkpoints para evitar falhas por tempo de execução.

4. **Melhorar a leitura do gráfico**
   - Tooltip exibirá somente as três composições válidas: Potencial de Vendas, Custos e Despesas.
   - Meses ainda não reconciliados terão indicação de “dados incompletos”, sem linha percentual enganosa em 0%.
   - Texto inferior explicará a média consolidada e listará apenas melhor/pior mês com dados completos.

## Validação

- Conferir mês a mês os totais de Receita Bruta e as três parcelas do custo contra o DRE em regime de caixa.
- Confirmar que fevereiro, março, maio e junho não aparecem mais como 0% por ausência de dados.
- Validar agosto pela fórmula: `(PV + Custos + Despesas) / Receita Bruta`.
- Verificar o gráfico e o tooltip no navegador após a reconciliação.

## Detalhes técnicos

- Ajustar `GRUPOS_OPERACAO`, `serieCustoOperacao` e `mediaMesesCompletos` em `src/lib/conta-azul/painel-analises.ts`.
- Atualizar o card, tooltip e texto em `src/components/financeiro/ContaAzulDashboard.tsx`.
- Reutilizar `calcularDRECaixa` com baixas e rateios; não criar uma regra financeira paralela.
- Usar o fluxo existente de reprocessamento em `src/lib/conta-azul/sync.server.ts`, com recorte mensal por `data_baixa` e sem filtro por vencimento.
