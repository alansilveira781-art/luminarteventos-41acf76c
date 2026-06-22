# Diagnóstico

O Dashboard mostra **24 saídas** em junho/2026, mas a aba Saídas mostra **218**. Os números no banco confirmam que, em junho, há **681 saídas** (72 ajustes Egestor + 609 reais) e **1.942 movimentações** no total (entradas + saídas + devoluções).

A causa é o limite de linhas do PostgREST (padrão **1000 por requisição**), que ignora o `.limit(2000)` quando o servidor está configurado com `max_rows = 1000`.

No `src/routes/dashboard.tsx`:

- `movsMes` busca `movimentacoes` do mês com `.select("*", ...embeds).order(data_movimento desc).limit(2000)`. Como junho tem 1.942 linhas e o servidor corta em 1000, voltam apenas as **1000 movimentações mais recentes** — predominantemente entradas dos últimos dias (inclusive os 72 ajustes Egestor de hoje). Dentro dessas 1000, sobram só **24 saídas**, que viram o KPI "Saídas (Junho/2026)".
- `movs12m` tem o mesmo problema (`.limit(20000)`), então o gráfico "Entradas vs Saídas (12 meses)" também está subcontando.
- `movsPeriodo` (tabela ABC inferior) usa `.limit(5000)` — também sujeita ao mesmo corte quando o período tiver muitos registros.

A aba Saídas (`src/routes/saidas.tsx`) puxa só `tipo='saida'` com `.limit(500)`; cabe nos 500 e por isso mostra o total correto do mês (218 grupos após agrupar por `requisicao_numero` e remover ajustes Egestor).

# Correção proposta (somente front-end / leitura, sem mexer em saldos)

Trocar as três queries do Dashboard por **fetch paginado** (mesmo padrão já usado pela query `itens` no próprio arquivo e por `fetchAllRows` em outras telas), em vez de confiar no `.limit(N)`:

1. `**movsMes**` — paginar em blocos de 1000 (`range(from, from+999)`) até acabar, mantendo os mesmos `select`, `gte`, `lte` e `order`. Resultado: KPIs "Entradas / Saídas / Devoluções" do período passam a refletir o total real do mês.
2. `**movs12m**` — mesma paginação para o intervalo de 12 meses; o gráfico "Entradas vs Saídas (12 meses)" passa a somar todas as movimentações, não só as 1000 mais recentes.
3. `**movsPeriodo**` — mesma paginação para o intervalo customizado da tabela ABC.

Sem alterações em:

- regras de `isAjusteMovimentacao`
- triggers, `quantidade_atual`, reconciliação, ou qualquer escrita
- aba Saídas / Entradas
- demais módulos

# Validação

- No mês atual (junho/2026), KPI "Saídas" do Dashboard passa a bater com a aba Saídas (218, após agrupamento; o KPI conta linhas, então pode ficar próximo a 609 — número de linhas de saída não-ajuste — o que **continua diferente do tab por design**, já que o tab agrupa por requisição). Se você quiser que o KPI conte **saídas agrupadas** (218) em vez de linhas (609), me avise que eu ajusto também — é uma decisão à parte.
- KPIs "Entradas" e "Devoluções" do mês passam a refletir o total real.
- Gráfico de 12 meses deixa de subestimar meses cheios.
- Saldos inalterados.

# Pergunta antes de implementar

O KPI "Saídas" deve contar **linhas de movimentação** (cada item de uma requisição = 1) ou **saídas agrupadas por requisição** (igual ao número exibido na aba Saídas)? A correção do limite é necessária nos dois casos; só muda se eu agrupo por `requisicao_numero` antes de contar.  
  
RESPOSTA  
Pronto, elas precisam contar a quantidade de requisições no período.  
  
É muito importante que você tome cuidado ao mexer nisso e que não altere saldos no banco dos itens, somente conserte a comunicação.