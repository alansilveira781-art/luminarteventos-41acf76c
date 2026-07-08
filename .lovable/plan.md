# Diagnóstico do rateio

## O que está acontecendo

Confirmei o que está acontecendo olhando o sync e os logs no banco:

1. A listagem do Conta Azul (`/contas-a-pagar/buscar`) **não devolve o valor de cada fatia** do rateio. Ela devolve só a lista de centros de custo e a lista de categorias, sem `valor` nem `percentual` por linha. Exemplo real que está gravado hoje em `ca_sync_log`:

```json
{
  "id": "9c36a349-...",
  "total": 1382.33,
  "categorias": [
    {"id":"...","nome":"CV - Bagum"},
    {"id":"...","nome":"CV - Carpete"}
  ],
  "centros_de_custo": [
    {"id":"...","nome":"Almoxarifado/Estoque"},
    {"id":"...","nome":"Almoxarifado/Estoque"}
  ]
}
```

Repare: nenhum campo `valor` ou `percentual` nas fatias.

2. Por isso o sync tenta enriquecer cada lançamento rateado batendo no endpoint de detalhe (`/contas-a-pagar/{id}`) e faz o merge do resultado. **A lógica de divisão só cai em "dividir igual pelo número de fatias" quando não encontra nem `valor` nem `percentual` em nenhuma fatia** (arquivo `src/lib/conta-azul/sync.server.ts`, função `distribuirValores`, linhas ~230-260). Ou seja: se o detalhe estivesse trazendo os valores certos, o rateio real seria usado.

3. O log `probe_rateio_detalhe_pagar` (que grava uma amostra do payload de detalhe) **está vazio** no banco. Isso significa que ou o endpoint de detalhe está falhando silenciosamente para todos os itens, ou está devolvendo o payload em uma forma que o código não reconhece como "tem rateio" (ex.: chaves com outros nomes, valores dentro de outro objeto, etc.).

Ou seja: o problema não é uma regra errada de rateio — é que **o código não está conseguindo ler o valor real das fatias no payload de detalhe** e por isso cai no fallback de divisão igual.

## O plano

Para resolver preciso primeiro **ver o payload cru do detalhe** de um lançamento rateado conhecido (o MAXMIDIAS 300/900 é perfeito) e depois ajustar o parser. Dois passos:

### Passo 1 — Capturar o payload de detalhe

Rodar o endpoint de diagnóstico que já existe (`/api/contaazul/diag-maxmidias`) e gravar o JSON completo do detalhe em `ca_sync_log`. Se o endpoint retornar erro (404/403), o próprio diagnóstico registra o erro — o que já é a resposta.

Como disparar (console do navegador, logado como admin):

```js
const { data: { session } } = await window.supabase.auth.getSession();
const r = await fetch('/api/contaazul/diag-maxmidias', {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}` },
});
console.log(await r.json());
```

Depois consultar:

```sql
select recurso, status, mensagem
from ca_sync_log
where recurso like 'diag_maxmidias%'
order by started_at desc;
```

### Passo 2 — Ajustar o parser em `sync.server.ts` conforme o payload real

Com o JSON em mãos, três ajustes possíveis (escolho o certo com base no que aparecer):

- **Caso A — o detalhe vem com nomes diferentes** (ex.: `rateios_centro_custo`, `valor_rateio`, `alocacoes_categoria`): adicionar essas chaves na lista de fontes lidas em `buildRateios` (linhas 174-215).
- **Caso B — o detalhe vem aninhado** (ex.: `it.rateio: { centros: [...], categorias: [...] }`): descer um nível antes de mapear.
- **Caso C — o endpoint de detalhe está falhando** (401/404/500): tratar o erro adequadamente e usar o endpoint alternativo (`/rateios` ou similar), ou pedir o valor via outro recurso.

Também vou adicionar log explícito de erro do detalhe (hoje o `catch` da linha 347 só incrementa contador sem logar), para nunca mais ficar cego.

### Passo 3 — Reprocessar

Depois do ajuste, rodar um sync incremental cobrindo o período do lançamento MAXMIDIAS para reescrever as linhas em `ca_lancamento_rateios` com os valores corretos (300/900 em vez de 600/600).

## Escopo

- **Não** mexo em nenhuma lógica de dashboard, DRE, evento nem em outro módulo.
- **Só** ajusto o parser de rateio em `src/lib/conta-azul/sync.server.ts`.
- Sem migration nova, sem novo endpoint (o `/api/contaazul/diag-maxmidias` já foi criado).

## Confirmação necessária antes de codar

Preciso do output do Passo 1 para saber qual dos casos A/B/C se aplica. Se você aprovar este plano, no build eu já assumo que você vai disparar o diag e me passar o resultado, ou me autoriza a implementar os três parsers alternativos de uma vez (mais defensivo, sem depender do payload exato).
