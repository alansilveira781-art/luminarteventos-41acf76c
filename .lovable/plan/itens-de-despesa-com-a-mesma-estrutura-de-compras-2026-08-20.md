# Itens de Despesa com a mesma estrutura de Compras

## O que muda

Nos cards de **Despesa**, na aba de itens (para todos os tipos que pedem itens: fardamento, material de limpeza, material de escritório, imobilizado e reposição de estoque), a grade passa a ter a mesma estrutura de Compras:

Linha 1: Item do estoque (opcional) | Descrição (livre)
Linha 2: Qtd | Unidade | Cotação | Desc. % | Valor unit.
Linha 3: Desconto (R$) | IPI | Frete | Outros | Subtotal

Comportamento igual ao de Compras:
- Ao digitar a **Cotação** (ex.: 12,50) e o **Desc. %**, o **Valor unit.** é calculado automaticamente (cotação menos o percentual) e continua editável manualmente.
- **Subtotal** = Qtd x Valor unit. − Desconto (R$) + IPI + Frete + Outros.
- O total da despesa passa a somar os subtotais com a mesma regra.
- O campo **Desconto (R$)** existente é mantido, conforme sua escolha.

## Banco de dados

Adicionar em `demanda_itens` as duas colunas que hoje só existem em `compra_itens`:
- `cotacao text`
- `desconto_percentual numeric`

Nenhum dado existente é alterado; itens antigos ficam sem cotação/percentual e continuam exibindo o valor unitário já gravado.

## Detalhes técnicos

- Migração: `ALTER TABLE public.demanda_itens ADD COLUMN cotacao text, ADD COLUMN desconto_percentual numeric;` (RLS e grants já existentes cobrem as novas colunas).
- `src/components/DemandaDialog.tsx`:
  - tipo do item ganha `cotacao` e `desconto_percentual`;
  - `select` de carregamento e `insert` de salvamento passam a incluir os dois campos;
  - nova função `updateCotacaoOrDesconto` espelhando a de `CompraDialog` (recalcula `valor_unitario = cotacao * (1 - desc/100)`, 4 casas);
  - layout da grade reorganizado em 3 linhas como acima;
  - fórmula de subtotal e do total mantida com o desconto em R$.
- `src/components/CompraDialog.tsx` não é alterado; os fluxos de recebimento em Estoque/Patrimônio continuam lendo `quantidade` e `valor_unitario`, que seguem preenchidos.
