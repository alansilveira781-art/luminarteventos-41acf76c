## Diagnóstico (já confirmado no banco)

Bati direto na API Conta Azul usando o access_token salvo em `conta_azul_credentials`:

- `GET /financeiro/eventos-financeiros/parcelas/94a2a5b6-d95c-4c0f-a3f0-b95e81fd3f15` responde **200 OK** com o rateio correto:
  ```
  evento.rateio[0].rateio_centro_custo = [
    { valor: 300.00, id_centro_custo: 514fc86e-...  (Método CIS) },
    { valor: 900.00, id_centro_custo: 44b8ddb2-...  (Stand Brahma) }
  ]
  ```
- O parser `buildRateios` em `src/lib/conta-azul/sync.server.ts` (linhas 177-229) **já lê esse formato certo**.
- Em `ca_lancamento_rateios` o lançamento MAXMIDIAS ainda está 600/600 porque nenhum sync usando a nova função rodou para junho/2026 depois da correção.

Ou seja: **não falta código; falta reprocessar o período**. E ninguém precisa clicar em nada no navegador.

## O que vou fazer

### 1. Reprocessar junho/2026 direto pelo servidor

Chamar `syncContasPagar('2026-06-01','2026-06-30')` e `syncContasReceber('2026-06-01','2026-06-30')` a partir de um pequeno server function `reprocessarPeriodo` protegido por `requireAdminOfModule('financeiro')`, e disparar via `psql`/curl usando um endpoint público interno protegido por API key (o mesmo padrão já usado em `/api/public/contaazul/cron`). Alternativa mais direta: rodar como um GET one-shot em `/api/public/contaazul/cron` já dispara `processNextHistoricoChunk` — mas como não há job histórico pendente, o caminho certo é criar um endpoint interno de "reprocessar mês" que aceite `{from,to}` e a project API key. Vou usar o endpoint que já existe (`/api/contaazul/reprocessar-falhas`) se ele aceitar alvo explícito; senão, adiciono uma variante `POST /api/contaazul/reprocessar-periodo` com auth admin.

Vou verificar `src/routes/api/contaazul/reprocessar-falhas.ts` durante a implementação e reaproveitar se ele já aceitar `{from,to,recurso}`. Caso contrário, adiciono um endpoint enxuto.

Disparo do sync no build via `curl` com header admin (session já disponível quando você abrir o preview) — ou eu mesmo posso rodar o sync in-process via um script Node one-shot em `code--exec` que carrega `sync.server.ts` e chama a função (não precisa expor endpoint novo).

Escolha final entre as duas: **rodo in-process via code--exec** (mais simples, sem alterar rotas). O sandbox tem acesso ao Postgres e às env vars do Conta Azul.

### 2. Verificar no banco

```sql
select centro_custo_external_id, valor, ordem
from ca_lancamento_rateios
where lancamento_external_id = '94a2a5b6-d95c-4c0f-a3f0-b95e81fd3f15'
order by ordem;
```

Esperado: **300,00** para `514fc86e-…` (Método CIS) e **900,00** para `44b8ddb2-…` (Stand Brahma).

### 3. Reprocessar meses anteriores com rateio suspeito

Rodar o mesmo sync para os últimos 12 meses de `ca_contas_pagar` / `ca_contas_receber`, mês a mês, para reescrever `ca_lancamento_rateios` com os valores reais. Log final agregado no chat.

### 4. Remover diagnóstico temporário

Depois que a validação da etapa 2 der 300/900:

- Deletar `src/routes/api/contaazul/diag-maxmidias.ts`.
- Remover o card "Diagnóstico do rateio" de `src/routes/financeiro-op.conta-azul.tsx`.

## Escopo

- **Não** mexo em `buildRateios` nem em `enrichItemsWithDetail` — já estão corretos.
- **Não** altero UI de dashboards, DRE, ou qualquer outro módulo.
- **Não** crio migration.
- Apenas: (a) rodo o sync de um período histórico, (b) deleto o endpoint/card de diagnóstico.

## Riscos

- Se o sync do mês inteiro falhar em algum item, os demais continuam (cada item é try/catch); ao final relato quantos passaram vs falharam.
- Reprocessar 12 meses = ~5-15 min de execução server-side (paginação + concurrency=5 no enrich). Confirmar se quer 12 meses ou apenas junho/2026 primeiro.

## Confirmação

Reprocesso **apenas junho/2026** primeiro para validar, ou já disparo os **últimos 12 meses** de uma vez?
