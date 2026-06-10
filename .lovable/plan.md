## Problema

Na aba **Painel de Vendas**, os cards estão calculados diferente do que a imagem de referência (Aba 1) especifica:

| Card | Imagem (correto) | Hoje no código |
|---|---|---|
| Vendas Totais | Σ `valor_final` | ✅ ok |
| **Qtde de Vendas** | **contagem de vendas** (nº de linhas) | ❌ soma da coluna `quantidade` da planilha (nº de convidados/itens) |
| Desconto | Σ `desconto` | ✅ ok |
| **Ticket Médio** | **total ÷ qtde de vendas (contagem)** | ❌ total ÷ soma de `quantidade` |

A mesma fórmula errada está sendo aplicada ao "Período Anterior" e ao "% LY", então os comparativos também ficam incorretos.

## Mudança

Ajustar `src/lib/comercial/vendas-metrics.ts`:

- `quantidade` no `kpis()` passa a ser `rows.length` (contagem de vendas), em vez de `sumQtde(rows)`.
- `ticketMedio` passa a ser `vendasTotais / rows.length`.
- Aplicar a mesma mudança ao período anterior (`quantidadeAnterior`, `ticketAnterior`).
- Manter `sumQtde` disponível caso outras telas usem (Relatórios/Vendedores), sem alterar essas abas neste passo.

Nenhuma mudança de schema, UI ou demais abas. Só recálculo dos KPIs do topo (que também são reusados na Aba 2).

## Validação

Após o ajuste, conferir no preview:
- "Qtde de Vendas" mostra um número inteiro próximo do total de eventos no período (não milhares de convidados).
- "Ticket Médio" = Vendas Totais ÷ Qtde de Vendas exibida no card ao lado.
