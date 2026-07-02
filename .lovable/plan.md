## Plano — Alternativa: policy dedicada para o Pedro

Criar uma exceção RLS pontual em `public.compras` amarrada ao **user_id** do Pedro (`9465f822-0273-4235-ba24-148cb1bf2c4b`), não ao e-mail. Isso restaura a edição sem promovê-lo a admin do módulo e sem reintroduzir bypass por string de e-mail.

### Migração

```sql
CREATE POLICY "compras_update_pedro"
ON public.compras
FOR UPDATE
TO authenticated
USING  (auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid)
WITH CHECK (auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid);
```

Policies em PostgreSQL são unidas por `OR`, então essa nova policy libera UPDATE só para o Pedro, sem afetar as demais regras existentes.

### O que **não** muda

- Movimentação de status: continua limitada a Solicitação → Análise → Pendente Aprovação (via `validate_compra_status_transition` + `canMoveCompra`, que já tratam o `isPedro` separadamente).
- Exclusão: segue as regras atuais (admin, criador, responsável do card, responsável do status).
- Frontend: `canEditCompra` já retorna `true` para o Pedro; nenhuma alteração de código.

### Observação

Se o Pedro trocar de e-mail/conta no futuro, essa policy precisa ser atualizada (é atrelada ao UUID). Documentarei isso no comentário da policy.