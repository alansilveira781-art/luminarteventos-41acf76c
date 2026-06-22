## Diagnóstico

Olhando os logs do servidor, encontrei dois problemas que explicam o Dashboard zerado:

1. **Build "preso" com referência fantasma**: o `routeTree.gen.ts` da última build (preview/produção) ainda apontava para `src/routes/api/public/hooks/comercial-vendas-sync.ts`, arquivo que apagamos. Isso fazia o servidor responder **500** quando o Dashboard tentava buscar as vendas — por isso "nada acontece". O dev-server do sandbox já regenerou o arquivo, mas a build publicada precisa rodar de novo.

2. **`listVendasDb` está usando o cliente admin (`supabaseAdmin`)** para uma leitura comum da aba Vendas/Dashboard. Esse caminho é frágil no Lovable Cloud: quando a chave injetada vier no formato novo `sb_secret_*`, a Data API retorna `Expected 3 parts in JWT; got 1` e o endpoint cai em 500 silencioso — exatamente o que aconteceu no `luminarteventos.lovable.app`. A recomendação oficial é usar o cliente do usuário autenticado (`requireSupabaseAuth`), que respeita RLS e usa a chave pública correta.

Confirmei na base: existem **1.050 vendas** com 2 empresas (`EVENTO`, `PLANEJADOS`) — os dados estão lá, o problema é só na leitura.

## O que vou fazer

### 1. Trocar `listVendasDb` para usar autenticação do usuário
Arquivo: `src/lib/comercial/vendas-db.functions.ts`

- Adicionar `.middleware([requireSupabaseAuth])`.
- Substituir `supabaseAdmin` por `context.supabase` (cliente do usuário logado, com RLS).
- Manter a mesma assinatura/retorno (`{ rows, fetchedAt, error? }`) para não quebrar a aba Vendas nem o Dashboard.

### 2. Garantir leitura para usuários autenticados em `comercial_vendas`
- Conferir as RLS atuais da tabela (`SELECT` para `authenticated`) e, se faltar, criar via migração uma policy `TO authenticated USING (true)` + `GRANT SELECT ON public.comercial_vendas TO authenticated` (só leitura; mutações já existem para a aba Vendas).

### 3. Forçar rebuild limpo
A edição do arquivo acima invalida o cache de build, regenera o `routeTree.gen.ts` sem a referência fantasma e republica o preview — encerrando o 500.

### 4. Validar
- Invocar `listVendasDb` via debug do servidor (esperado: 200 com `rows.length > 0`).
- Abrir `/comercial/dashboard/painel` no Playwright e conferir que os KPIs deixam de mostrar `R$ 0` e que os selects de **Ano** e **Empresa** (apenas `EVENTO` e `PLANEJADOS`) aparecem preenchidos.
- Cadastrar uma venda na aba Vendas e confirmar que o Dashboard reflete sem F5 (realtime já está ligado).

## Observação

Nada na lógica de filtros/KPIs muda — eles já estão corretos desde o último ajuste. O problema atual é puramente de leitura/build, não de cálculo.
