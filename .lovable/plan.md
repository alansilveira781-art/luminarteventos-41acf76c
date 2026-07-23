## Módulo Jurídico — numeração de ID por tipo

Hoje os cards do Jurídico não têm um identificador amigável (só `id` UUID). Vamos replicar o padrão de `COMPRA-XXX` (sequência Postgres + coluna `numero`) e diferenciar contrato de aditivo.

### Banco
- Migração:
  - Adicionar coluna `tipo text not null default 'contrato'` em `public.juridico_contratos` com check em (`'contrato'`, `'aditivo'`).
  - Criar duas sequências independentes: `juridico_contrato_numero_seq` e `juridico_aditivo_numero_seq`.
  - Adicionar coluna `numero integer` (única por `tipo`).
  - Trigger `BEFORE INSERT` que, se `numero IS NULL`, faz `nextval` da sequência correspondente ao `tipo`.
  - Backfill: preencher `numero` nos contratos existentes usando `juridico_contrato_numero_seq` na ordem `created_at`.
  - Ajustar `setval` das sequências para o maior valor atual.

### UI Jurídico (`src/routes/juridico.index.tsx`)
- Novo passo inicial (ou seletor) no diálogo "Novo contrato" para escolher **Contrato** ou **Aditivo** (além das opções existentes "criar pelo modelo" / "anexar pronto").
- Exibir no card e no diálogo o ID no formato `CONTRATO-1` / `ADITIVO-1` (uppercase, igual `COMPRA-XXX`).
- Incluir `numero` e `tipo` no `select` do Kanban, na busca (`num = ${tipo}-${numero}`) e no cabeçalho do `ContratoDialog`.
- Modelos (`juridico_modelos`) já têm `tipo`; ao escolher "Aditivo", filtrar modelos com `tipo='aditivo'` (fallback: mostrar todos se não houver).

## Módulo Comercial — Vendas: campo Tipo vira seletor

Em `src/routes/comercial.vendas.tsx` (diálogo Nova/Editar venda, linha ~681):
- Substituir o `<Input>` do campo **Tipo** por um `Select` (padrão igual ao de **Empresa**) com apenas duas opções: `Venda` e `Extra`.
- Ao criar uma linha nova, deixar `Venda` como valor padrão.
- Nenhuma migração de dados: o campo continua sendo `text` na tabela `comercial_vendas`; linhas antigas com outros valores permanecem, mas o seletor força os novos registros aos dois valores permitidos.
- Não altero o filtro superior de Tipo nem a coluna da tabela (o usuário só pediu o campo de criação).

## Fora de escopo
- Não altero regras de negócio de Compras, Financeiro nem dashboards.
- Não removo a coluna `proposta_numero`/`proposta_ref` do Jurídico (retrocompat, como acordado antes).
