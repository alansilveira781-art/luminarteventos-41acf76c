## Situação atual (verificada)

Hoje cada compra/despesa tem **um único** par de campos texto:
- `condicao_pagamento` — usado na prática como "cartão / forma" (é o filtro do Relatório de Cartão em Financeiro Op.)
- `parcelamento` — ex.: "3x"

Isso existe em `compras` e `demandas`, é preenchido em `CompraDialog`, `DemandaDialog`, no formulário público `/solicitar` e é lido pelo Quadro Financeiro, Dashboard de Compras, Dashboard Financeiro e Relatório de Cartão.

## O que será feito

### 1. Banco: novas tabelas de rateio de pagamento
Seguindo o mesmo padrão de `compra_itens` / `demanda_itens`:

- `compra_pagamentos` e `demanda_pagamentos`, cada uma com: vínculo ao card, **forma de pagamento** (cartão/condição), **parcelamento**, **valor**, ordem e observação.
- GRANTs, RLS espelhando as políticas das tabelas pai (quem vê/edita a compra vê/edita seus pagamentos), timestamps + trigger de `updated_at`.
- Os campos antigos `condicao_pagamento` e `parcelamento` **permanecem** na tabela e passam a guardar um resumo (a forma de maior valor, ou "Múltiplas" quando houver mais de uma) — assim nada que já lê esses campos quebra.
- Migração de dados: para cada compra/despesa que já tem `condicao_pagamento` ou `parcelamento` preenchido, criar automaticamente **uma linha** de pagamento com o valor total do card. Assim o histórico fica consistente no novo formato.

### 2. Interface (Compras e Despesas)
Nos diálogos de compra e de despesa, a seção de pagamento vira uma **grade** (igual à grade de itens):
- Linhas com: Forma de pagamento (lista criável, mesma de hoje) · Parcelamento · Valor · botão remover.
- Botão "Adicionar forma de pagamento".
- Rodapé mostrando **soma das formas × valor total do card**, com aviso em vermelho quando divergir (tolerância de R$ 0,01) e bloqueio do salvamento enquanto não bater.
- Botão "Usar valor restante" para preencher a última linha rapidamente.
- Quando houver só uma forma, a tela fica visualmente igual ao que é hoje (uma linha).

### 3. Leituras afetadas (todas atualizadas)
- **Relatório de Cartão** (`financeiro-op.relatorios.tsx`): passa a filtrar pelas linhas de pagamento, então uma compra dividida em 2 cartões aparece em cada relatório **pelo valor daquele cartão** (hoje apareceria pelo total, duplicado).
- **Detalhe do card no Quadro Financeiro**: lista todas as formas com valor e parcelamento.
- **Dashboard de Compras** e **Dashboard Financeiro** (agrupamento por condição de pagamento): passam a somar por linha de pagamento, ficando corretos com pagamentos divididos.
- Visualizações somente leitura (Meus Pedidos, detalhes) exibem a lista.

### 4. Formulário público `/solicitar`
Mantém uma única forma de pagamento (o solicitante normalmente não sabe da divisão); ela é gravada como a primeira linha de pagamento. A divisão em vários cartões é feita internamente por quem executa a compra.

## Detalhes técnicos

- Tabelas novas: `public.compra_pagamentos`, `public.demanda_pagamentos` (FK com `on delete cascade`).
- Arquivos: `src/components/CompraDialog.tsx`, `src/components/DemandaDialog.tsx`, novo `src/components/PagamentosGrid.tsx` (compartilhado), `src/routes/compras.index.tsx`, `src/routes/financeiro.index.tsx`, `src/routes/financeiro-op.quadro.tsx`, `src/routes/financeiro-op.relatorios.tsx`, `src/routes/compras.dashboard.tsx`, `src/routes/financeiro.dashboard.tsx`, `src/routes/meus-pedidos.tsx`.
- Sem alteração no fluxo de status, estoque ou patrimônio.

## Premissas (avise se preferir diferente)

1. A soma das formas de pagamento deve ser **igual** ao valor total do card (bloqueio ao salvar).
2. Nas telas de relatório, uma compra dividida aparece **uma vez por cartão**, com o valor daquele cartão.
