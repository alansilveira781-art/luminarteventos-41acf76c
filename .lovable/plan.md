## Ajustes no Dashboard Comercial

### 1. Detalhamento de Vendas — usar somente Data de Registro

Em `src/routes/comercial.dashboard.index.tsx`:
- Ordenação (linhas ~216-218): trocar `a.dataRegistro || a.dataEvento` por apenas `a.dataRegistro` (mesmo para `b`).
- Coluna Data (linha 515): trocar `fmtDataBR(r.dataRegistro || r.dataEvento)` por `fmtDataBR(r.dataRegistro)`.

Isso alinha o Detalhamento com o restante do dashboard, que já usa exclusivamente a data de registro.

### 2. Tooltip com valor exato nos valores abreviados

Objetivo: onde o valor aparece abreviado ("R$ 1,2 Mi", "R$ 350 Mil"), ao passar o mouse deve aparecer o valor completo (ex.: "R$ 1.234.567,89").

**a) KPI Cards (`src/components/comercial/dashboard/KpiCard.tsx`)**
- Envolver o valor principal e o valor "anterior" em `<span title={valorCompletoFormatado}>` quando `isMoney`.
- Adicionar helper `brlFull(v)` retornando `v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })`.

**b) Gráficos Recharts (todos os `<Tooltip>` que usam `brlAbrev` como formatter)**

Arquivos afetados:
- `src/routes/comercial.dashboard.painel.tsx` (Evolução Vendas, Ticket, Ranking Consultores, Classificação)
- `src/routes/comercial.dashboard.index.tsx` (mesmos gráficos + Comissões, Cerimonial, Decorador, Tipo de Evento, Ano A vs B, Pizza Classificação)
- Demais abas do dashboard que reutilizam o mesmo padrão (`comercial.dashboard.vendedores.tsx`, `comercial.dashboard.indicadores.tsx`, `comercial.dashboard.relatorios.tsx`, `comercial.dashboard.propostas.tsx`) — varrer e aplicar a mesma correção onde houver `brlAbrev` no formatter do Tooltip.

Trocar em todos os `<Tooltip formatter={(v) => brlAbrev(v)} ...>` para usar o valor **completo** (`brlFull`), já que o Tooltip é o lugar natural para ver o número exato. Os `<LabelList>` continuam abreviados (é o comportamento desejado para caber no gráfico).

**c) Rótulos abreviados em tabelas/legendas fora de Recharts** (ex.: linha 819 do index)
- Adicionar `title={brlFull(value)}` no elemento que renderiza o texto abreviado.

### Detalhes técnicos

- Criar `brlFull` uma vez em um utilitário compartilhado (ex.: `src/lib/comercial/format.ts`) e importar nos arquivos, evitando duplicação.
- Não alterar `brlAbrev` — continua sendo usado em labels de gráfico e KPI para responsividade.
- Sem mudanças em lógica de negócio, apenas apresentação.
