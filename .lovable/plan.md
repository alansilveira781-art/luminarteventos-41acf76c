# Plano — Endurecer comunicação com o banco e segurança

Aplicar as quatro correções da revisão, em ordem de prioridade.

---

## A. Proteger endpoints públicos com segredo (prioridade alta)

Hoje `api/public/hooks/comercial-vendas-sync` e `api/public/contaazul/cron` aceitam qualquer chamada da internet. Vou exigir um token (um por endpoint, conforme escolha).

**Novos secrets (via add_secret):**
- `CRON_SECRET` — para `/api/public/contaazul/cron`
- `VENDAS_SYNC_SECRET` — para `/api/public/hooks/comercial-vendas-sync`

**Mudanças no handler:**
- Ler `Authorization: Bearer <token>` (ou `?token=` como fallback para o agendador do pg_cron).
- Comparar com o secret usando `timingSafeEqual`.
- Retornar `401` quando ausente/incorreto. Quando correto, processar normalmente.

**Chamadores legítimos a atualizar:**
- `pg_cron` que dispara `/contaazul/cron` (atualizar o `net.http_post` em migration para incluir o header com o token — sem expor valor em SQL: usar `current_setting` ou hardcode do valor sob orientação do usuário em uma migration controlada).
- Qualquer ponto da UI que dispare `/contaazul/cron` imediatamente após iniciar carga histórica (passar token via server fn no backend, nunca do browser).
- Hook do Dropbox de `comercial-vendas-sync` (se configurado externamente, o usuário coloca o header no Dropbox; documento isso).

**Importante:** o token não pode vazar para o navegador. Se a UI precisar disparar o cron, fazer via `createServerFn` com `requireSupabaseAuth` que injeta o header no fetch interno.

---

## B. Restringir RLS de tabelas de negócio comerciais

Trocar policies `USING (true)` por checagem de módulo nas tabelas de negócio. Catálogos (`modulos`, `compradores`) ficam como estão.

**Migration:**
- `comercial_vendas` — substituir policies por `USING (public.has_module_access(auth.uid(), 'comercial'))` em SELECT/INSERT/UPDATE/DELETE; manter `service_role` com `ALL`.
- `comercial_vendas_sync` — mesma regra (módulo `comercial`).
- `ca_dre_estrutura` — restringir ao módulo `financeiro`.
- Revisar e listar quaisquer outras tabelas com `USING(true)` para confirmar antes de aplicar (executar `supabase--read_query` no `pg_policies` durante a implementação).

---

## C. Confirmar gravação com `.select()` em inserts/updates críticos

Estender o padrão já adotado em Entradas/Saídas/Devoluções (`insert(...).select("id")` + verificação de retorno + `ensureValidSession()` + `describeSupabaseError`) para outras mutações de escrita:

- `CompraDialog` (insert/update de compras e itens).
- `DemandaDialog` (insert/update de demandas).
- `financeiro.rotinas.tsx` (criação/edição de rotinas e execuções).
- `juridico_contratos` (criar/editar contratos).
- `patrimonio/Movimentacoes.tsx` e `patrimonio/Devolucoes.tsx`.
- `rh_vagas`, `solicitantes`, `fornecedores` (CRUD).

Para cada mutation:
1. `await ensureValidSession()` antes do insert/update.
2. `.insert(...).select("id")` (ou `.update(...).select("id")`).
3. Validar que o retorno tem o tamanho esperado; se não, lançar erro claro.
4. `await qc.refetchQueries(...)` antes de fechar modal.
5. Usar `describeSupabaseError` no `onError`.

---

## D. Trocar `.single()` por `.maybeSingle()` onde aplicável

Varrer com `rg "\.single\(\)"` os 18 usos, classificar cada um:
- **Manter `.single()`** quando o registro é garantidamente único (ex.: inserts com `.select().single()` logo após criar).
- **Trocar por `.maybeSingle()`** quando a ausência é possível (lookup por id vindo de URL, busca de configuração opcional, etc.) e tratar `null` na UI sem quebrar a tela.

---

## Validação

- Após A: chamar os endpoints sem token → 401; com token → 200.
- Após B: `supabase--read_query` em `pg_policies` confirma novas policies; teste manual com usuário sem módulo Comercial não vê linhas em `comercial_vendas`.
- Após C: salvar registros em cada módulo afetado e confirmar que toast só aparece após `.select()` retornar; simular sessão expirada e verificar mensagem clara.
- Após D: rotas listadas abrem mesmo quando o registro alvo não existe (mostra estado vazio, não tela quebrada).

## Fora de escopo

- Edge Functions `admin-create-user` / `admin-update-user` (já protegidas via service role).
- Reorganização de buckets de storage.
- Auditoria dinâmica via Security Advisor do Supabase (recomendar ao usuário rodar manualmente depois).
