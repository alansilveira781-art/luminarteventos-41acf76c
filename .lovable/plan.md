## Garantir preenchimento do Dashboard com a planilha do Dropbox

O server function `listVendasDropbox` já baixa o arquivo `CONTROLE-DE-VENDAS-NOVO.xlsx` do link enviado e parseia a aba **Base de Dados** (1.002 linhas, R$ 33,3 Mi confirmados no teste local). O problema é que vários gráficos/filtros dependem de `anoEvento`, `mesEvento` e `trimestreEvento`, e hoje:

- A planilha **não tem** as colunas "Mês Evento" / "Ano Evento" → `mesEvento` e `anoEvento` ficam **null**.
- `trimestreEvento` só é calculado quando `dataEvento` existe.
- Resultado: filtro de mês não casa e a "Evolução por Trimestre" fica vazia em vários casos.

### Ajustes no parser (`src/lib/comercial/vendas.functions.ts`)

Derivar campos do `dataEvento` (com fallback para `dataRegistro`):

- `anoEvento` ← ano de `dataEvento` (ou `dataRegistro`, ou coluna "Ano")
- `mesEvento` ← nome do mês em PT-BR de `dataEvento` (ou `dataRegistro`)
- `trimestreEvento` ← derivado da mesma data usada acima
- Normalizar `mes` da planilha para Title Case ("JANEIRO" → "Janeiro") para casar com o select dos filtros

### Ajuste no filtro (`src/lib/comercial/vendas-metrics.ts`)

Comparar mês de forma case-insensitive em ambos os lados (`mes` e `mesEvento`) — evita o caso atual em que "JANEIRO" da planilha não bate com "Janeiro" do filtro.

### Filtro inicial

Hoje o default é `ano: 2026` (ano corrente). Como 2026 ainda tem só 74 registros, o painel parece "vazio". Trocar o default para o **último ano com dados** (calculado a partir das linhas carregadas) ou para `"Todos"` para que o usuário veja conteúdo logo de cara.

### Out of scope

Sem mudanças de layout, KPIs, charts, autenticação ou abas. Apenas garantir que os dados do Dropbox aparecem corretamente em todas as abas do dashboard.

### Pergunta

Filtro inicial deve abrir em **"Último ano com dados" (ex. 2025)** ou em **"Todos"**?
