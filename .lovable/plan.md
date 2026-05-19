## Objetivo

Revisar os arquivos criados para a integração Conta Azul (sem mexer em telas de A Pagar/A Receber/Extrato) e deixar tudo correto e leve. Abaixo o que encontrei e o que proponho ajustar.

## Arquivos revisados

- `src/routes/financeiro.conta-azul.tsx` (UI)
- `src/routes/api/contaazul/oauth.prepare.ts` (inicia OAuth)
- `src/routes/api/contaazul/oauth.callback.ts` (troca code→token)
- `src/routes/api/contaazul/status.ts` (status / desconectar)
- `src/routes/api/contaazul/sync.ts` (POST sincronizar)
- `src/lib/conta-azul/client.server.ts` (OAuth + caFetch + tokens)
- `src/lib/conta-azul/sync.server.ts` (sync de 5 recursos)
- `src/lib/conta-azul/auth-check.server.ts` (guard admin do módulo)

## Problemas encontrados

### Correção
1. **Escopo OAuth muito restrito.** `buildAuthorizeUrl` pede apenas `scope=sales`. Para `/plan-of-accounts`, `/cost-centers`, `/financial-events`, `/bank-statements` o Conta Azul exige escopos adicionais → a sincronização vai falhar com 403 mesmo conectado. Ajustar para o conjunto completo necessário (ex.: `sales finance accounts cost-centers bank-statements` — confirmar nomes exatos na doc).
2. **`caFetch` não tenta refresh em 401.** Se o access_token for invalidado antes do `expires_at`, falha sem tentar renovar. Pequeno retry em 401 (1 vez) deixa mais robusto.
3. **Logs visíveis para qualquer usuário.** O `useQuery(["ca-sync-log"])` roda sem `enabled: canManage` — usuários comuns disparam a query (RLS bloqueia, mas é request desnecessário e ruidoso). Gatear por `canManage`.

### Performance / risco de timeout (essa é a maior dor)
4. **Sync síncrono dentro de uma única request HTTP.** `POST /api/contaazul/sync` executa, em sequência, 5 recursos com paginação (até 200 páginas × 100 itens cada). Em Cloudflare Worker isso passa fácil dos limites de CPU/wall‑time e o usuário fica com a aba travada. Proposta:
   - Reduzir o cap (ex.: 50 páginas) e tamanho de página padrão (size=200 quando suportado).
   - Sincronizar **um recurso por request** (a UI dispara 5 chamadas pequenas em paralelo controlado) **ou** quebrar `syncTudo` em chamadas separadas chamadas sequencialmente pelo cliente, atualizando a UI a cada passo.
   - Em qualquer caso, **upsert em lotes** de ~500 linhas (hoje envia todos os itens de uma vez — Supabase rejeita payloads grandes e gasta memória do worker).
5. **Cada recurso refaz `new Date().toISOString()` por linha.** Trocar por uma constante por chamada. Microtimização, mas evita custo desnecessário em volumes grandes.
6. **Auth-check cria um `createClient` novo a cada request.** OK funcional, mas o ideal é validar o JWT só com `supabaseAdmin.auth.getUser(token)` (já temos o admin) e remover o segundo cliente — menos código carregado no Worker.
7. **UI:** `useMemo` importado e não usado; `from`/`to` recomputados a cada render. Limpeza simples.

### Higiene
8. Padronizar mensagens de erro (algumas vazam o texto bruto da API).
9. Adicionar `AbortSignal` no `fetchPaged` para cancelar quando o cliente desiste.

## O que vou alterar

| Arquivo | Mudança |
|---|---|
| `client.server.ts` | Escopos completos no `buildAuthorizeUrl`; retry de 1x em 401 no `caFetch` com refresh forçado. |
| `sync.server.ts` | Upsert em lotes de 500; reduzir cap de páginas; `synced_at` constante por chamada; aceitar `AbortSignal`. |
| `api/contaazul/sync.ts` | Aceitar `recurso?: "plano_contas"|"centros_custo"|"contas_pagar"|"contas_receber"|"extrato"|"tudo"` para a UI chamar em pedaços. |
| `financeiro.conta-azul.tsx` | Gatear `logs` por `canManage`; chamar sync recurso‑a‑recurso com progresso; limpeza de imports. |
| `auth-check.server.ts` | Validar token apenas via `supabaseAdmin.auth.getUser(token)`; remover `createClient` extra. |

## Fora do escopo
- Telas de A Pagar / A Receber / Extrato (você pediu para não criar).
- Cron de sincronização automática.
- Múltiplos CNPJs.

## Dependências
- Confirmar a lista exata de escopos com a doc do Conta Azul antes de publicar (se eu errar o nome, a tela de autorização cai com erro). Posso usar o que documentação pública indica e ajustar se aparecer `invalid_scope`.
