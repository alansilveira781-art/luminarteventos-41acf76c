# Painel Financeiro, auditoria Conta Azul e ajustes em Compras

## 1. Cards do Painel Financeiro (6 cards)

Ordem: Receita Bruta, Pot. de Vendas, Despesas, Custos, Investimentos, Lucro.

- **Pot. de Vendas** = AC + DM + DC
- **Despesas** = DS + DA + DT + **DF** (hoje falta DF)
- **Custos** = CV + CD + CI
- **Investimentos** (novo card) = grupo IN (IV, EM, IN do plano de contas)
- **Lucro** = resultado final do DRE

Apresentação: Pot. de Vendas, Despesas, Custos e Investimentos passam a exibir o
valor **em vermelho e sem o sinal de menos** (a cor já indica a saída). Receita
Bruta permanece neutra e Lucro fica verde/vermelho conforme o resultado.
O mesmo conjunto de 6 cards vai para o PDF do painel.

## 2. Detalhamento do gráfico "Custo de operação x Receita"

O tooltip deixa de agrupar em 3 blocos (Potencial de Vendas / Custos / Despesas)
e passa ao formato da imagem 2:

```text
Ago/2026
Receita Bruta        R$ ...
Custo de operação    R$ ...
% de operação        ...%
-------------------------------
Deduções da Receita       R$ ...
Aquisição de Clientes     R$ ...
Despesas com Marketing    R$ ...
Despesas Comerciais       R$ ...
Custos Variáveis          R$ ...
Custos Diretos            R$ ...
Custos Indiretos          R$ ...
Despesas com Sócio        R$ ...
Despesas Administrativas  R$ ...
Despesas Tributárias      R$ ...
Despesas Financeiras      R$ ...
-------------------------------
Investimentos             R$ ...   (informativo, fora do total)
```

Cada linha usa o rótulo e o valor do grupo do próprio demonstrativo, listando
somente grupos com valor no mês. Investimentos aparece separado, abaixo do
total, e **não** entra no custo de operação nem no percentual.

## 3. Auditoria das receitas e pagamentos direto na API do Conta Azul

Objetivo: confirmar que o painel reflete exatamente o que foi pago/recebido em
cada mês, pela data da baixa.

1. Para cada mês de jan a ago/2026, consultar a API do Conta Azul e somar as
   liquidações reais (recebimentos e pagamentos) do período.
2. Comparar com o que está gravado no banco (baixas por data de baixa) e montar
   um quadro de divergências por mês e por tipo.
3. Onde houver diferença, identificar a causa (título sem detalhe sincronizado,
   baixa parcial não gravada, lançamento sem categoria, rateio inconsistente) e
   reprocessar o período pela rotina de sincronização.
4. Repetir a comparação até os totais do banco baterem com a API.
5. Ajustar a sincronização quando a divergência for estrutural (por exemplo,
   liquidação que a busca geral da API não retorna e só aparece no detalhe do
   lançamento), para que novos meses já entrem corretos.

Ao final, apresento o quadro final de conferência mês a mês (API x painel).

## 4. Módulo Compras — filtro por condição de pagamento

Novo filtro no quadro de compras por forma de pagamento (PIX, Cartão, Boleto,
Dinheiro, Transferência etc.), lido tanto do campo de condição de pagamento do
card quanto da grade de pagamentos. Cards com mais de uma forma aparecem em
todos os filtros correspondentes (ex.: um card PIX + Cartão aparece nas duas
seleções). Seleção múltipla, no mesmo padrão dos demais filtros do quadro.

## 5. Rótulos de status por quadro

Os cards de aquisição (DEMANDA-) exibem hoje "Aquisição Aprovada", "Aquisição Em
Andamento", "Aquisição Negada" e "Solicitação de Aquisição". No quadro unificado
de Compras, o status passa a seguir o nome da coluna do quadro (Aprovada, Em
Andamento, Negada, Solicitação etc.), independentemente de o card ser compra ou
aquisição. Onde a origem precisar ficar clara, ela continua sinalizada pelo
prefixo do identificador (COMPRA- / DEMANDA-).

## Detalhes técnicos

- `src/components/financeiro/ContaAzulDashboard.tsx`: composição dos KPIs
  (linhas 472-476 e 1437-1441), novo card de Investimentos, estilo vermelho sem
  sinal, tooltip do gráfico e lista de KPIs enviada ao PDF.
- `src/lib/conta-azul/painel-analises.ts`: `COMPOSICAO_OPERACAO` passa a
  detalhar grupo a grupo (DR, AC, DM, DC, CV, CD, CI, DS, DA, DT, DF) e a
  devolver Investimentos como linha informativa separada.
- `src/lib/conta-azul/painel-pdf.ts`: acomodar 6 KPIs.
- `src/lib/conta-azul/sync.server.ts` e as rotas de reprocessamento: correções
  de sincronização identificadas na auditoria.
- `src/routes/compras.index.tsx` (+ `KanbanFilters`): filtro de forma de
  pagamento considerando `condicao_pagamento` e as tabelas de pagamentos de
  compras e demandas.
- `src/lib/demandas.ts`: rótulos de status alinhados ao quadro de Compras.
