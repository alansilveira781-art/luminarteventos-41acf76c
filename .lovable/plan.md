## Objetivo
Corrigir dois problemas na aba "A Receber" do módulo Estoque:
1. A baixa do recebimento não reflete no Quadro de Compras (RLS bloqueia UPDATE em `compras` para usuários só do módulo estoque).
2. Não existe botão "Devolver para Compras" no `ReceberDialog`.

## Alterações

### 1. Nova migration SQL — restaurar permissão de UPDATE
Recriar a política `compras_update_owner_or_admin` da tabela `public.compras` para incluir novamente `is_module_admin(auth.uid(), 'estoque')`, mantendo `created_by`, `is_admin` e `is_module_admin('compras')`.

### 2. `src/routes/estoque.a-receber.tsx`
Dentro do `ReceberDialog`:
- Adicionar imports: `Undo2` em `lucide-react`.
- Novos estados: `devolverOpen` e `motivoDevolucao`.
- Nova mutation `devolver`:
  - Revalida que a compra ainda está em `a_receber`.
  - Atualiza `compras.status` para `em_andamento`.
  - Insere registro em `compra_comentarios` com o motivo (prefixado com "🔄 Devolvido para Compras Em Andamento").
  - Em sucesso: invalida `["compras"]` e `["compras-receber"]`, fecha dialogs, toast.
- Atualizar `DialogFooter`:
  - Layout em duas colunas (esquerda: "Devolver para Compras"; direita: "Cancelar" + "Finalizar recebimento").
  - Sub-dialog inline com `Textarea` obrigatório para o motivo e botão "Confirmar devolução" (variant destructive).

## Não fazer
- Não alterar `src/routes/compras.index.tsx` nem `src/components/CompraDialog.tsx` — comentários e movimentação de coluna já ocorrem automaticamente.
- Não criar novas tabelas (compra_comentarios já existe).
- Não tocar em outras políticas RLS, migrations ou módulos.

## Critérios de aceite
- Usuário com acesso apenas ao módulo Estoque consegue finalizar o recebimento e o card sai do Quadro de Compras (status vira `finalizado`).
- Botão "Devolver para Compras" aparece no rodapé do ReceberDialog, exige motivo, volta o card para `em_andamento` e registra o motivo nos comentários da compra.
