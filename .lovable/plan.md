# Diagnóstico crítico — Conta Azul

## Como "está conectado" se o token muda?

A conexão é real e renovada sozinha. O fluxo:

1. Você autoriza uma vez → recebemos `access_token` (≈ 1h, JWT do Cognito) **+ `refresh_token` (longa duração)**.
2. Os dois ficam em `conta_azul_credentials` (tabela única, apenas administradores acessam).
3. A cada chamada à API, `getValidAccessToken()` confere `expires_at`. Se faltar menos de 60s, troca o `refresh_token` por um novo `access_token` automaticamente.
4. Se mesmo assim a API responder 401, fazemos **um retry forçado** com refresh e tentamos de novo.

Verifiquei agora no banco: `expires_at` foi renovado durante a última sincronização (`17:45:29`) — ou seja, o refresh **funcionou**. "Conectado" significa "temos refresh_token válido e estamos renovando o access_token sob demanda". Só quebra se o usuário revogar o acesso no Conta Azul ou se passarem ~30 dias sem uso.

## O que realmente falhou na última sincronização

| Recurso | Resultado | Causa real |
|---|---|---|
| plano_contas | ok / 0 reg | parâmetro obrigatório `permite_apenas_filhos` faltando + leitura do array errada (API devolve `itens`, código lê `items`) |
| centros_custo | ok / 0 reg | leitura do array errada (`itens` vs `items`) |
| contas_pagar | **400** | parâmetro errado: enviamos `data_vencimento_inicio`/`_fim`, doc exige `data_vencimento_de`/`_ate` |
| contas_receber | **400** | mesma coisa |
| extrato | ok / 0 reg | `/conta-financeira` devolve `itens`, código lê `items` |

Confirmei lendo a OpenAPI oficial:
- `GET /v1/categorias` — `permite_apenas_filhos` é **required**; resposta = `{ itens_totais, itens[] }`
- `GET /v1/centro-de-custo` — resposta = `{ itens_totais, items[] }` (sim, este usa `items`)
- `GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar` — `data_vencimento_de` e `data_vencimento_ate` são required; resposta = `{ itens_totais, itens[] }`; status enum = `PERDIDO | RECEBIDO | EM_ABERTO | RENEGOCIADO | RECEBIDO_PARCIAL | ATRASADO`
- `GET /v1/conta-financeira` — resposta = `{ itens_totais, itens[] }`

# Plano de correção

## 1. `src/lib/conta-azul/sync.server.ts`

**`fetchPaged`** — ler `result.itens` **primeiro** (esse é o padrão da API), com `items`/`content`/`data` como fallback. Isso por si só já desbloqueia `plano_contas`, `centros_custo` e `extrato`.

**`syncPlanoContas`** — adicionar `permite_apenas_filhos=false` (busca raiz) na chamada de `/categorias`. Mapear campos reais: `id`, `nome`, `categoria_pai`, `tipo` (RECEITA/DESPESA), `entrada_dre`.

**`syncContasPagar` / `syncContasReceber`** — trocar parâmetros para `data_vencimento_de` / `data_vencimento_ate`. Reescrever mapeamento usando os campos documentados:
- `external_id` ← `it.id`
- `descricao` ← `it.descricao`
- `valor` ← `it.total` (ou `it.nao_pago` + `it.pago`)
- `data_vencimento` ← `it.data_vencimento`
- `status` ← derivado de `it.status_traduzido`
- `categoria_external_id` ← `it.categorias?.[0]?.id`
- `centro_custo_external_id` ← `it.centros_custo?.[0]?.id`
- `fornecedor_nome` / `cliente_nome` ← `it.fornecedor?.nome` / `it.cliente?.nome`
- `documento` ← omitir (não existe na API v2) ou usar `it.numero_documento` se presente

**`normalizeStatus`** — mapear o enum oficial:
- `RECEBIDO` → `pago`
- `ATRASADO` ou `PERDIDO` → `atrasado`
- `EM_ABERTO`, `RENEGOCIADO`, `RECEBIDO_PARCIAL` → `em_aberto`

**`syncExtrato`** — manter `/conta-financeira` (não há endpoint único de extrato na v2), mas mapear corretamente: `it.id`, `it.banco`, `it.nome`, `it.saldo_atual`. Manter o aviso no log de que é um snapshot de saldo, não um histórico de lançamentos. (Para extrato real do período seria preciso combinar `/saldo-inicial` + parcelas pagas — pode ser uma evolução futura, fora deste fix.)

## 2. Verificação

Após o deploy, rodar "Sincronizar agora" e conferir o histórico:

- Esperado: as 5 linhas com status `ok`.
- `plano_contas` e `centros_custo` devem trazer >0 registros (a menos que a conta realmente esteja vazia).
- `contas_pagar`/`contas_receber` no período selecionado devem retornar os lançamentos reais.
- `extrato` traz uma linha por conta financeira com o saldo atual.

Se algum recurso ainda voltar 0 com `ok`, fazemos uma consulta direta no banco (`SELECT * FROM ca_*`) para descobrir se é dado vazio na origem ou ainda erro de mapeamento.

## Fora de escopo (proponho discutir depois)

- Extrato real diário (combinar saldo inicial + parcelas + transferências).
- Sincronização incremental usando `/financeiro/eventos-financeiros/alteracoes` em vez de varrer tudo a cada clique.
- Job agendado (cron) para sincronizar sozinho.
