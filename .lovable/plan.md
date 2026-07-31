## Diagnóstico (verificado no banco agora)

Comparei as duas tabelas de pagamento no banco:

- `compra_pagamentos` (148 linhas) **já tem** as colunas `data_pagamento`, `pago` e `pago_em`. O módulo Compras lê e grava esses campos corretamente.
- `demanda_pagamentos` (128 linhas) **não tem** essas três colunas. Só existem: `demanda_id`, `forma`, `parcelamento`, `valor`, `ordem`, `observacao`, `created_at`, `updated_at`.

Consequências, hoje:

1. A tela do Quadro de Despesas que acabei de montar consulta `data_pagamento, pago, pago_em` em `demanda_pagamentos` — essa consulta **vai falhar** (coluna inexistente), então nenhum card de despesa mostrará as marcações âmbar/badges.
2. O diálogo de Despesa exige preencher data prevista e situação para PIX parcelado, mas **não grava** esses dados: ao salvar, ele apaga e reinsere as linhas só com forma/parcelamento/valor/ordem. A informação se perde ao reabrir o card.
3. Em Compras, as colunas existem e funcionam, porém hoje ainda há **0 registros** com data prevista ou marcados como pagos — ou seja, o recurso ainda não foi usado na prática, não é um bug de gravação.

As permissões (RLS) das duas tabelas já estão equivalentes: acesso pelo módulo (financeiro/estoque para despesas, compras/estoque para compras) e leitura pelo próprio solicitante. Nada precisa mudar aí.

## O que fazer

### 1. Migração no banco (única alteração estrutural)
Adicionar em `demanda_pagamentos`, espelhando `compra_pagamentos`:
- `data_pagamento` (data, opcional)
- `pago` (sim/não, padrão "não")
- `pago_em` (data, opcional)

Impacto: as 128 linhas existentes ficam com data vazia e situação "em aberto" — nenhum dado é perdido nem alterado. Não há mudança de permissões, índices pesados ou triggers. Compras não é afetada.

### 2. Ajustar o diálogo de Despesa (`src/components/DemandaDialog.tsx`)
- Ler as três novas colunas ao abrir o card.
- Gravar as três novas colunas ao salvar (mesma lógica de Compras: `pago_em` só quando `pago = true`; campos nulos quando a forma não é PIX parcelado).

### 3. Confirmar o Quadro de Despesas (`src/routes/financeiro.index.tsx`)
Após a migração, a consulta de pagamentos passa a funcionar e os cards mostram borda âmbar, badge "Parcelado", "Quitado", valor pago/total, próxima data e parcelas vencidas — igual ao Quadro de Compras.

### 4. Verificação final
- Criar/editar uma despesa com PIX parcelado, salvar, reabrir e conferir que data e situação persistem.
- Conferir no banco que as linhas gravaram os novos campos.
