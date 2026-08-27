# Alinhar impostos por evento ao rateio da apuração

Hoje os dois lugares divergem porque usam métodos diferentes:

- Análise Detalhada: aplica as alíquotas direto sobre o valor do evento (R$ 4.400 → R$ 498,52 = 11,33%).
- Relatórios (Contábil): rateia o total apurado da empresa no mês (Julho/Luminart Eventos: R$ 76.676,26 sobre R$ 541.474,52 = 14,16%) → R$ 623,07.

A diferença é o **adicional de IRPJ** (10% sobre a base presumida acima de R$ 20.000/mês), que só existe no total mensal da empresa.

## O que muda

A Análise Detalhada passa a usar o mesmo critério de rateio de Relatórios:

1. Para cada recebimento do evento, identifica a **empresa** e o **mês** do recebimento.
2. Calcula o imposto total daquela empresa/mês sobre **todos** os recebimentos do mês (com adicional de IRPJ quando houver).
3. Rateia proporcionalmente: parcela do evento = imposto do mês × (recebido do evento no mês ÷ recebido total da empresa no mês).
4. Faz isso imposto a imposto (IRPJ com adicional embutido, CSLL, PIS, COFINS), somando quando o evento tem recebimentos de mais de uma empresa ou mês.

Resultado: o COPA FANTÁSTICA 2026 passa a mostrar ~R$ 623,07 em Deduções da Receita, batendo com a aba Relatórios.

## Detalhes

- Detalhamento clicável continua listando um item por recebimento (data, NF, empresa), agora com o valor já rateado.
- Percentuais verticais, cards e Lucro seguem o novo valor automaticamente.
- Empresas no Simples (DAS) continuam sendo tratadas pelas alíquotas ativas cadastradas.
- Nada muda na aba Relatórios, na Apuração nem no Painel Financeiro.

## Técnico

- Arquivo: `src/components/financeiro/ContaAzulDashboard.tsx` (`AnaliseDetalhada`).
- A query de `contabil_recebimentos` deixa de filtrar só o evento: passa a trazer todos os recebimentos das competências (empresa + mês) em que o evento tem recebimento, para obter o denominador do rateio.
- `calcularImpostosPresumido` é chamado uma vez por empresa/mês com o faturamento total do mês; o valor por imposto é então multiplicado pela fatia do evento (usando `total`, que inclui o adicional).
- Mantém as chaves sintéticas `imposto:IRPJ|CSLL|PIS|COFINS` no grupo `DR` e o ajuste de resíduo de arredondamento na maior fatia, igual ao rateio de `contabil.relatorios.tsx`.
