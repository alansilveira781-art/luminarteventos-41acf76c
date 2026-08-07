# Migrar compras da coluna "A Receber" para Despesa (levando tudo)

## O que muda

Hoje o botão "Migrar para Despesa" só aparece nos cards da coluna **Solicitação**, e a migração leva apenas os dados básicos e os itens — anexos, pagamentos e comentários ficam para trás.

Passa a ser assim:

- O botão de migrar também aparece nos cards da coluna **A Receber** (mesma regra de permissão de edição já usada hoje).
- A migração leva **tudo** do card:
  - dados do card (título, fornecedor, solicitante, valores, NF, documento, comprador, datas, prazo, observações, responsável, origem, e-mail do solicitante)
  - itens
  - **anexos** (os arquivos são copiados para o armazenamento de despesas, mantendo nome, tipo e tamanho)
  - formas de pagamento / parcelas (incluindo marcação de pago e datas)
  - comentários (com autor e data originais)
- O card migrado a partir de "A Receber" entra na coluna **A Receber** das Despesas; migrado a partir de "Solicitação", entra em "Solicitação" (comportamento atual).
- A compra original só é removida depois que a despesa, os anexos e os demais registros forem criados com sucesso. Se algum anexo falhar na cópia, a migração é interrompida com aviso e nada é apagado.

## Detalhes técnicos

Arquivo: `src/routes/compras.index.tsx` (componente `MigrarCompraDialog` e cálculo de `canMigrate`).

- `canMigrate`: passa a aceitar `c.status === "solicitacao" || c.status === "a_receber"`.
- No `handleConfirm`, além do que já existe:
  - buscar `compra_anexos`, `compra_pagamentos`, `compra_comentarios` da compra;
  - para cada anexo: `download` do bucket `compra-anexos` e `upload` no bucket `demanda-anexos` em `demandas/<nova_id>/<arquivo>`, depois inserir em `demanda_anexos` (nome, path, mime_type, tamanho, uploaded_by);
  - inserir `demanda_pagamentos` (forma, parcelamento, valor, ordem, observacao, data_pagamento, pago, pago_em);
  - inserir `demanda_comentarios` (user_id, user_nome, texto, mencoes, created_at);
  - `status` da nova demanda = status de origem da compra;
  - campos extras copiados no payload: `comprador`, `data_compra`, `documento`, `solicitante_email`, `prazo`, `origem`, `op_ordem_id`, `status_financeiro`.
  - limpeza final: remover arquivos do bucket `compra-anexos`, e as linhas de `compra_anexos`, `compra_pagamentos`, `compra_comentarios`, `compra_itens` antes de deletar a compra.

Sem mudanças de banco de dados — todas as tabelas e colunas necessárias já existem.
