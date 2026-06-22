## Problema

A aba **Validações** em Despesas → Rotinas Financeiras só aparece para quem é admin do módulo Financeiro. O Maicon tem acesso ao módulo, mas com `is_admin = false` — por isso a seção não aparece para ele e ele não consegue aprovar/rejeitar execuções que exigem validação.

## Solução

Promover o Maicon a admin do módulo Financeiro, atualizando o registro dele em `user_modulos` (somente para o módulo `financeiro`).

- Usuário afetado: **Maicon Viana** (`maicon@luminarteventos.com.br`, id `7df29f9f-beb0-4710-9036-17996e9cbd82`)
- Mudança: `user_modulos.is_admin = true` apenas na linha onde `modulo_id` corresponde ao slug `financeiro`
- Nenhum outro módulo, usuário, código ou regra é alterado

## Resultado esperado

- Após relogar (ou recarregar), o Maicon passa a ver a aba **Validações** em Rotinas Financeiras, com a contagem de pendentes
- Ele pode aprovar/rejeitar execuções que exigem validação
- Os demais usuários do módulo Financeiro continuam sem essa aba (comportamento inalterado)

## Detalhe técnico

Uma única operação de dados via `UPDATE`:

```sql
UPDATE public.user_modulos
SET is_admin = true
WHERE user_id = '7df29f9f-beb0-4710-9036-17996e9cbd82'
  AND modulo_id = (SELECT id FROM public.modulos WHERE slug = 'financeiro');
```

Sem migrations, sem mudanças em código, sem mudanças em RLS.