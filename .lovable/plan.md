## 1. Pagamentos com datas diferentes (Quadro de Compras)

Hoje cada forma de pagamento da compra guarda apenas forma, parcelamento e valor — não há data nem controle de baixa.

**Banco de dados** — adicionar em `compra_pagamentos`:
- `data_pagamento` (data prevista da parcela/pix)
- `pago` (sim/não) e `pago_em` (data da baixa)

**Formulário da compra (CompraDialog › Formas de pagamento)**
- Cada linha ganha o campo "Data prevista" e uma caixinha "Pago" (com data da baixa preenchida automaticamente ao marcar).
- A validação de soma dos valores continua igual.

**Card no quadro**
- Quando a compra tiver duas ou mais datas de pagamento distintas, o card fica amarelado (fundo/borda em tom âmbar, via tokens de tema, funcionando também no modo escuro).
- O card exibe um selo "Parcelado" e uma linha de resumo: `Pago R$ X de R$ Y · próxima em DD/MM`.
- Quando todas as parcelas estiverem pagas, o selo vira "Quitado" e o card volta ao visual normal (sem amarelo).
- Parcela vencida e não paga: a data aparece em vermelho.

## 2. Análise de Saving (Compras › Dashboard)

Fonte: campo **Cotação** já existente em cada item da compra.

- Valor cotado = soma de `cotação × quantidade` dos itens (itens sem cotação preenchida ficam de fora do cálculo e são contados à parte).
- Valor final = soma de `valor unitário × quantidade` dos mesmos itens.
- Saving = cotado − final; % saving = saving ÷ cotado.

Nova seção "Saving de Compras" no dashboard, respeitando os filtros de período e empresa já existentes:
- Cards: Valor cotado, Valor final, Saving (R$), Saving (%), e nº de compras sem cotação (cobertura da análise).
- Gráfico de barras: saving por mês (cotado vs. final).
- Ranking: top fornecedores por saving gerado.
- Tabela: top 10 compras por saving, com número da compra, fornecedor, cotado, final, saving e %.
- Savings negativos (compra acima da cotação) aparecem destacados em vermelho.

## Detalhes técnicos

- Migração em `compra_pagamentos`: `data_pagamento date`, `pago boolean not null default false`, `pago_em date`; políticas RLS atuais permanecem.
- `src/lib/pagamentos.ts`: estender `PagamentoLinha` e adicionar helpers `resumoPagamentos()` (total pago, restante, próxima data, vencidas) e `temDatasDistintas()`.
- `src/components/PagamentosGrid.tsx`: colunas adicionais de data e baixa.
- `src/components/CompraDialog.tsx`: persistir os novos campos no upsert de pagamentos.
- `src/routes/compras.index.tsx`: carregar `compra_pagamentos` (uma query agregada) e passar o resumo ao componente `Card` para cor e rótulos.
- `src/routes/compras.dashboard.tsx`: a query de `compra_itens` já traz `valor_unitario`; incluir `cotacao` e `desconto_percentual`, com parse numérico tolerante (o campo é texto e pode vir como "1.234,56").
