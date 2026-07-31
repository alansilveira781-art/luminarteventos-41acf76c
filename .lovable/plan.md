## Problema

Hoje, ao escolher PIX **2x**, o formulário mostra **uma única** data prevista, **um** valor e **uma** situação para a forma inteira. Por isso:
- não dá para informar as duas datas/valores reais (entrada + restante);
- o card não fica amarelo, porque o destaque depende de existirem **duas datas de pagamento diferentes** no banco — com uma linha só, nunca há duas.

## O que será feito

### 1. Parcelas dentro de cada forma de pagamento (Compras e Despesas)
No bloco de formas de pagamento (`PagamentosGrid`), quando a forma for **PIX** e o parcelamento for maior que 1x:
- o cartão passa a listar **N parcelas** (2x → Parcela 1 e Parcela 2), cada uma com: **Data prevista**, **Valor** e **Situação (Pago / Em aberto)**;
- ao trocar 2x → 3x, as parcelas são recriadas mantendo o que já foi preenchido; ao voltar para "à vista"/cartão, as parcelas somem e sobra só Forma + Parcelamento + Valor, como hoje;
- o **Valor** da forma passa a ser a soma das parcelas (dividido igualmente por padrão, editável, com ajuste de centavos na última);
- validação ao salvar: toda parcela precisa de data e situação, e a soma das parcelas precisa bater com o valor da forma; a soma das formas continua tendo que bater com o valor total.

### 2. Gravação no banco
Cada parcela vira **uma linha** em `compra_pagamentos` / `demanda_pagamentos` (mesma forma e mesmo parcelamento, com número da parcela, data, valor e situação). Nenhuma mudança de schema é necessária — as colunas `data_pagamento`, `pago` e `pago_em` já existem nas duas tabelas. Registros antigos (uma linha só) continuam abrindo normalmente e são convertidos para o novo formato quando editados.

### 3. Destaque âmbar do card
Nos quadros de Compras e de Despesas, o card fica amarelo quando houver **parcelamento com parcelas em aberto** — passando a considerar também o parcelamento declarado (ex.: PIX 2x), não apenas datas distintas. Badges continuam mostrando "Parcelado · N em aberto", valor pago x total, próxima data e parcelas vencidas.

### 4. Novo tipo de despesa
Adicionar **"Material Copa"** à lista de tipos de despesa do módulo Despesas.

## Detalhes técnicos

- `src/lib/pagamentos.ts`: estrutura de parcelas por linha (ou linhas irmãs agrupadas por forma), helpers `distribuirParcelas`, `validarPagamentos` atualizado e `statusPagamentos` considerando `parcelasDe(parcelamento) > 1`.
- `src/components/PagamentosGrid.tsx`: render das N parcelas dentro do cartão da forma; valor da forma vira somatório somente-leitura quando parcelado.
- `src/components/CompraDialog.tsx` e `src/components/DemandaDialog.tsx`: leitura/gravação de múltiplas linhas por forma (delete + insert já usado hoje), preservando `resumoPagamentos` nos campos legados.
- `src/routes/compras.index.tsx` e `src/routes/financeiro.index.tsx`: incluir `parcelamento` na query de pagamentos do quadro para o cálculo do destaque.
- `src/lib/demandas.ts`: novo item `material_copa` → "Material Copa" em `TIPO_DEMANDA_OPTIONS` (despesa comum, sem grid de itens/estoque, salvo indicação em contrário).
