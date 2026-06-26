## Objetivo
Corrigir o botão "Compartilhar com Maicon" em Rotinas Financeiras, que falha para usuários não-admin (Elano) por dois motivos: clipboard sem fallback e RLS bloqueando INSERT de notificação para outro `user_id`.

## Alterações

### 1. Migration SQL — política de INSERT em `public.notificacoes`
Substituir a política `"notificacoes insert own"` por uma nova `"notificacoes insert authenticated"` que permite qualquer usuário autenticado inserir notificações (inclusive para outros `user_id`). Demais políticas (SELECT/UPDATE/DELETE) permanecem inalteradas.

### 2. `src/routes/financeiro.rotinas.tsx`
- Adicionar helper `copyToClipboard(text)`:
  - Tenta `navigator.clipboard.writeText` em contexto seguro.
  - Fallback: cria `<textarea>` temporário, seleciona e usa `document.execCommand('copy')`.
- Reescrever `shareWithMaicon`:
  - Usa `copyToClipboard`; em caso de falha exibe `toast.info` com o link para cópia manual (duração 8s).
  - Mantém o INSERT em `notificacoes` para o `MAICON_USER_ID` com mensagem de erro melhorada.

## Não fazer
- Não alterar outras políticas RLS de `notificacoes` nem de outras tabelas.
- Não criar Edge Functions nem mexer em arquitetura.
- Não tocar em outros módulos ou arquivos.

## Critérios de aceite
- Elano (não-admin) consegue copiar o link e o Maicon recebe a notificação sem erro de RLS.
- Quando o clipboard falhar, o link aparece no toast para cópia manual.
