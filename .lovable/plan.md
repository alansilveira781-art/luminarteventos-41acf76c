## 1. Enriquecer `CardDetalheDialog` em `src/routes/financeiro-op.quadro.tsx`

- Adicionar query para buscar o registro completo (`select("*")`) de `compras` ou `demandas` conforme `card.origem`.
- Adicionar query para buscar anexos em `compra_anexos` (fk `compra_id`) ou `demanda_anexos` (fk `demanda_id`), campos: `id, nome, path, mime_type, tamanho`.
- Reestruturar o dialog com seções tituladas:
  - **Dados**: grid usando `Info`, renderizando somente campos com valor — número, título, status, status_financeiro, data_solicitacao, data_compra, comprador, responsavel_nome, parcelamento/condicao_pagamento, documento, numero_nf/numeros_nf, e específicos por origem (`tipo_compra`/`empresa_faturada` para compra; `tipo_demanda`/`evento_projeto` para despesa).
  - **Observações**: bloco de texto se houver `observacoes` (ou `descritivo` para despesa).
  - **Itens**: manter tabela atual.
  - **Anexos**: lista com nome + tamanho formatado + botão que gera signed URL (`supabase.storage.from(bucket).createSignedUrl(path, 3600)`) e abre em nova aba; bucket `compra-anexos` ou `demanda-anexos`. Exibir "Nenhum anexo" se vazio. Sem upload nem exclusão.
- Rodapé permanece com botão "Fechar". `max-h-[90vh] overflow-y-auto` mantido.
- Nenhuma mudança na lógica do quadro (colunas, drag, permissões).

## 2. Corrigir visibilidade de Eventos em `src/components/AppSidebar.tsx`

- Na função de filtro (linhas ~156–165), adicionar antes do `return true` final:
  ```ts
  if (i.module === "eventos") return ctx === "eventos" && (isAdmin || hasModule("eventos"));
  ```
- Nenhuma outra alteração.
