**Diagnóstico**
- Natanael tem acesso ao módulo Compras, mas não é admin do módulo.
- Os status sob responsabilidade dele estão configurados corretamente: solicitação, análise, aprovada, em andamento, a receber e finalizado.
- O problema principal está na política de atualização da tabela de compras: ela só permite alterar cards quando o usuário é criador, admin ou admin do módulo. Como Natanael não criou os cards, o front move visualmente, mas o banco rejeita a gravação; ao atualizar, o card volta ao status anterior.
- A trigger de validação já permite o responsável do status de destino, mas a política de atualização roda antes/junto e bloqueia a persistência.

**Plano de correção**
1. Ajustar a política de atualização de compras no banco para permitir que o usuário responsável pelo status de destino configurado consiga atualizar o card.
2. Manter a regra de segurança atual: Natanael só poderá puxar/mover cards para status em que ele é o responsável configurado; não poderá tirar cards para status de outra pessoa.
3. Preservar permissões existentes para criador do card, admins e admins do módulo.
4. Refinar o front-end para aguardar a confirmação real do banco antes de mostrar sucesso no drag-and-drop, evitando a sensação de que salvou quando foi bloqueado.
5. Ajustar a mensagem de erro para explicar quando o card não foi fixado por regra de responsável.
6. Validar com consulta no banco que a política passou a contemplar o responsável do status de destino e que o fluxo permanece bloqueado para status de outro responsável.

**Técnico**
- Migração para substituir a política `compras_update_owner_or_admin` por uma política que também permita atualização quando `auth.uid()` for o responsável em `compras_status_defaults` para `compras.status`.
- Pequeno ajuste em `src/routes/compras.index.tsx` no `onConfirm` do diálogo de avanço para usar `mutateAsync` com `try/catch`, igual ao fluxo automático.