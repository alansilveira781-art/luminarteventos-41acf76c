## Correção: expectadores não veem eventos no Calendário Público

### Causa
O gate no front (`src/routes/calendario-publico.tsx`) libera a tela para `profiles.is_expectador_eventos = true`, mas o RLS de `public.eventos` só permite SELECT para admin e membros do módulo `eventos`. Resultado: query retorna zero linhas silenciosamente.

### Passos

**1. Migration — nova política de SELECT em `public.eventos` para expectadores**

- Criar função `SECURITY DEFINER` `public.is_expectador_eventos(_user_id uuid)` que retorna `true` se `profiles.is_expectador_eventos = true` para aquele usuário. Evita recursão RLS entre `eventos` e `profiles` (mesmo padrão de `has_role`/`is_admin`).
  - `search_path = public`, `stable`, `language sql`.
- Garantir `GRANT SELECT ON public.eventos TO authenticated` (idempotente).
- Criar policy adicional (não substitui as existentes):
  ```sql
  CREATE POLICY "Expectadores podem ver eventos"
    ON public.eventos
    FOR SELECT
    TO authenticated
    USING (public.is_expectador_eventos(auth.uid()));
  ```
- Não tocar em políticas atuais (admin / módulo eventos). Nada para `anon`. Nenhuma policy de INSERT/UPDATE/DELETE.

**2. Melhoria de robustez no front — `src/routes/calendario-publico.tsx`**

- Na query `["eventos-publico"]`, capturar `error` do Supabase e lançar (`if (error) throw error`) para que o React Query exponha o erro em vez de exibir tela vazia.
- Adicionar bloco visual de erro (mensagem curta) quando `isError`, com botão de recarregar.

### Verificação

- Logar com usuário só com `is_expectador_eventos = true` (sem módulos): `/calendario-publico` lista os eventos.
- Mesmo usuário: tentar `insert/update/delete` em `eventos` via cliente continua bloqueado por RLS.
- Admin e membros do módulo `eventos` seguem enxergando tudo como antes.

### Detalhes técnicos

- Função nova: `public.is_expectador_eventos(uuid) returns boolean` — SECURITY DEFINER, evita ler `profiles` sob RLS a partir da policy de `eventos`.
- Nenhum ajuste em `profiles` RLS necessário (a função definer contorna).
- Nenhum grant para `anon` — mantém a remoção deliberada de 20260710221819.
