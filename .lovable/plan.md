
## Diagnóstico (confirmado pela doc oficial)

A API mudou de host **e** de paths. A nova plataforma usa `https://api-v2.contaazul.com/v1/...`, paginação em **português** (`pagina` começando em **1**, `tamanho_pagina` com valores fixos `10/20/50/100/200/500/1000`) e nomes de recursos novos. Não existe mais endpoint único de "Extrato Bancário" — ele é composto a partir de contas financeiras + parcelas + transferências.

## Mudanças

### 1. `src/lib/conta-azul/client.server.ts`
- `API_BASE` → `https://api-v2.contaazul.com/v1`

### 2. `src/lib/conta-azul/sync.server.ts` — reescrita do `fetchPaged` e dos paths

**Novo `fetchPaged`:**
- Params: `pagina` (começa em 1) e `tamanho_pagina=100`.
- Lê itens de `result.items` (fallback `content`/`data`) e total de `result.itens_totais` para decidir parar.
- Mantém o limite de segurança (50 páginas = 5000 registros por recurso).

**Novos paths e filtros:**

| Recurso (mantém o slug interno) | Path novo | Filtros de período |
|---|---|---|
| `plano_contas` | `GET /categorias` | — |
| `centros_custo` | `GET /centro-de-custo` | `filtro_rapido=TODOS` |
| `contas_pagar` | `GET /financeiro/eventos-financeiros/contas-a-pagar/buscar` | `data_vencimento_inicio`, `data_vencimento_fim` |
| `contas_receber` | `GET /financeiro/eventos-financeiros/contas-a-receber/buscar` | `data_vencimento_inicio`, `data_vencimento_fim` |
| `extrato` | `GET /conta-financeira` | (sem filtro de data — lista as contas bancárias com saldo atual) |

**Sobre "extrato":** mantenho o slug `extrato` no log/UI para não quebrar a tela, mas o que vai ser sincronizado agora é a **lista de contas financeiras** (banco, caixa, cartão) com saldo. Documento isso na mensagem da sincronização. Extrato completo (lançamentos por dia em uma conta) exige compor 3-4 endpoints — proponho fazer numa segunda iteração se você quiser, pra não atrasar essa entrega.

**Mapeamento de campos:** mantenho os mapeamentos atuais com múltiplos fallbacks (`it.id ?? it.uuid`, `it.nome ?? it.name ?? it.descricao`, etc.) — assim o upsert funciona mesmo com pequenas variações do schema novo, e ajustamos se algum campo importante vier vazio.

### 3. Status (apenas em contas a pagar/receber)
A API nova usa `PENDENTE | QUITADO | CANCELADO | RENEGOCIADO | ATRASADO`. Atualizo o `normalizeStatus` para mapear esses valores PT → o enum que já está no DB (`em_aberto`/`pago`/`atrasado`).

## Verificação

1. Clicar **"Sincronizar agora"** na tela do Conta Azul.
2. Esperado: as 5 linhas no histórico voltam com status **ok** e contagem de registros (ou 0 se não houver dados no período, sem erro).
3. Se algum recurso falhar com 4xx, eu olho a mensagem (que vem da API) e ajusto os filtros — geralmente é nome de query param que mudou.

## Arquivos alterados

- `src/lib/conta-azul/client.server.ts` (mudança de 1 linha)
- `src/lib/conta-azul/sync.server.ts` (reescrita do `fetchPaged`, paths e `normalizeStatus`)

