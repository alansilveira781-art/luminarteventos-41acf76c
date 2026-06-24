## 1) Olhinho nos campos de senha (admin de usuários)

Arquivo: `src/routes/admin.usuarios.tsx`

- Adicionar um botão com ícone `Eye` / `EyeOff` (lucide-react) dentro dos campos de senha:
  - Diálogo **Novo usuário** → campo "Senha".
  - Diálogo **Editar usuário** → campo "Nova senha".
- Estado local `showPassword` por diálogo alterna o `type` do `<Input>` entre `password` e `text`.
- O olhinho mostra apenas o que está sendo digitado no momento. Senhas já salvas continuam invisíveis — elas ficam criptografadas no banco e não há como recuperá-las (limitação de segurança do sistema de autenticação). Para "ver" a senha de alguém, o admin precisa definir uma nova ali no formulário.

Sem mudanças de backend.

## 2) Pedro consegue mover cards de Compras

**Diagnóstico:** o código do frontend já libera o Pedro (`pedro123jrsergio@gmail.com`) para mover cards entre **Solicitação de Compra → Análise de Compra → Pendente Aprovação**. O problema é no **banco de dados**: a regra de segurança da tabela `compras` (RLS) só permite atualizar um card se o usuário for `responsavel_id`, `created_by` ou admin do módulo. Pedro não é nenhum dos três na maioria dos cards, então o banco rejeita a movimentação silenciosamente.

**Correção (migração SQL):** ajustar as políticas de `UPDATE` e `DELETE` da tabela `public.compras` para incluir uma exceção pelo `user_id` do Pedro (`9465f822-0273-4235-ba24-148cb1bf2c4b`).

```text
UPDATE policy compras_update_owner_or_admin:
  permitir quando auth.uid() = '9465f822-...-148cb1bf2c4b' (Pedro)
  além das condições existentes (responsável, criador, admin).

DELETE policy compras_delete_owner_or_admin:
  mesma exceção para Pedro.
```

A regra do frontend continua impondo que Pedro só pode mover entre as 3 colunas iniciais (`Solicitação`, `Análise`, `Pendente Aprovação`) — isso não muda. O ajuste no banco apenas destrava o `UPDATE` para que a movimentação permitida pelo frontend efetivamente persista.

## Resumo do que muda

- **Frontend:** olhinho mostrar/ocultar nos 2 campos de senha do admin.
- **Banco:** migração que adiciona o id do Pedro nas políticas de update/delete de `compras`.
- **Sem mudanças** nas regras do Natanael, nas demais permissões, ou no fluxo de notificações.
