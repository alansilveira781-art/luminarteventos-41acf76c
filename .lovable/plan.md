## 1. "Data prevista" só para PIX parcelado

Em `src/components/PagamentosGrid.tsx`:
- Renderizar o campo **Data prevista** apenas quando `exigeControleParcelas(p)` for verdadeiro (PIX com parcelamento maior que 1), no mesmo bloco condicional da **Situação**.
- Quando a forma/parcelamento deixar de exigir controle, limpar também `data_pagamento` (hoje o `update()` já limpa `pago` e `pago_em`), evitando datas órfãs no banco.
- Layout: com o campo escondido, "Parcelamento" e "Valor" ficam lado a lado; quando PIX parcelado, aparecem Data prevista + Situação.

Validação em `src/lib/pagamentos.ts` continua igual (data e situação obrigatórias apenas nesses casos).

## 2. Mesmo sistema no módulo Despesas (Quadro de Despesas)

O `DemandaDialog` já usa o `PagamentosGrid` com as mesmas regras, então herda o item 1 automaticamente. Falta a **sinalização nos cards**, que hoje só existe no Quadro de Compras.

Em `src/routes/financeiro.index.tsx` (Quadro de Despesas), replicar o que existe em `compras.index.tsx`:
- Nova query carregando `demanda_pagamentos` (`demanda_id, valor, data_pagamento, pago, pago_em`) e agrupamento por demanda com `statusPagamentos()`.
- Passar o status ao componente `Card` como prop `pagto`.
- No card:
  - fundo/borda âmbar quando parcelado e não quitado;
  - badge "Parcelado · N em aberto";
  - badge "Quitado" ou texto "Pago X de Y · próx. dd/mm/aaaa";
  - badge vermelho com número de parcelas vencidas.
- Invalidar a query de pagamentos ao salvar uma despesa, para o card atualizar na hora.

### Detalhes técnicos
- Reuso total de `statusPagamentos`, `formatBRL` e tipos de `src/lib/pagamentos.ts`; nenhuma mudança de banco é necessária (a tabela `demanda_pagamentos` já tem `data_pagamento`, `pago` e `pago_em`).
