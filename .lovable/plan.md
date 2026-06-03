# Erro 503 da Conta Azul

O print mostra: `503 — Estamos passando por uma instabilidade, tente novamente mais tarde`. É **instabilidade transitória do lado da Conta Azul**, não bug nosso. Apesar disso, sincronizou 3.332 registros — só Contas a Pagar falhou no meio.

Mesmo sendo do lado deles, podemos tornar nosso cliente resiliente para não interromper a sincronização nesses casos.

# Correção

Adicionar **retry com backoff exponencial** em `caFetch` (`src/lib/conta-azul/client.server.ts`):

- Re-tenta automaticamente em respostas `503`, `502`, `504`, `429` e em erros de rede.
- Até **4 tentativas** com espera 1s → 2s → 4s → 8s entre elas (respeitando `Retry-After` quando vier).
- Não re-tenta `4xx` (a não ser `408`/`429`) — esses são erro nosso, não transiente.
- Loga no console (`server-function-logs`) cada retry para diagnóstico.

Isso beneficia tudo: sincronização manual, D-1 do cron e a carga histórica (que processa 1 mês por minuto e antes morria se um dos meses pegasse uma instabilidade).

Adicionalmente, no toast da UI vou trocar o texto do erro: quando a mensagem contém `503` + `instabilidade`, mostrar **"Conta Azul está instável, vamos tentar de novo automaticamente"** em vez do JSON cru.

# Arquivos

- `src/lib/conta-azul/client.server.ts` — envolver `doFetch` num loop com retry.
- `src/routes/financeiro.conta-azul.tsx` — formatar mensagem de erro 503 de forma amigável no toast.

Sem schema. Sem mudança de comportamento fora do retry.

Posso aplicar?
