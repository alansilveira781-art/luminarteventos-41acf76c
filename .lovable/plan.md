
## Contexto

O Painel de Vendas já filtra corretamente por data de registro (via `applyFilters` → `pickDateIso`, que prioriza `dataRegistro`). As demais abas ainda misturam data do evento em pontos específicos, o que faz KPIs, listagens e filtros divergirem do que o usuário espera.

Pontos confirmados no código:

- `src/lib/comercial/propostas-metrics.ts` — a aba **Propostas** filtra e agrupa por `p.evento.dataInicio` (data do evento), não pela data de criação da proposta.
- `src/routes/comercial.dashboard.index.tsx` — aba **Indicadores/Relatório**: a tabela detalhada ordena e exibe `dataEvento || dataRegistro`, e o auto-seleção de ano usa `anoEvento` antes de `ano`.
- `src/routes/comercial.dashboard.painel.tsx` — mesma auto-seleção de ano baseada em `anoEvento` (Painel funciona porque o filtro real usa registro, mas a lógica está inconsistente).

## Mudanças

1. **`src/lib/comercial/propostas-metrics.ts`**
   - `parseDataInicio` → renomear para `parseDataRegistro` e usar apenas `p.createdAt` (data de cadastro da proposta). Remover fallback para `evento.dataInicio`.
   - `aplicarFiltrosPropostas` e `evolucaoMensalPropostas` passam a usar essa nova função — filtro por ano/mês e evolução mensal ficam por data de registro.

2. **`src/routes/comercial.dashboard.index.tsx`**
   - Ordenação de `linhasRelatorio`: usar `dataRegistro || dataEvento` (registro primeiro).
   - Coluna de data da tabela (linha 464): exibir `fmtDataBR(r.dataRegistro || r.dataEvento)`.
   - Auto-seleção de ano (linhas 132-151): substituir a lógica baseada em `anoEvento` por `getAno(r)` (já usa data de registro via `pickDateIso`).

3. **`src/routes/comercial.dashboard.painel.tsx`**
   - Auto-seleção de ano (linhas 62-81): mesma troca por `getAno(r)`, para manter consistência entre abas.

Nenhuma outra aba precisa mudar — `vendedores`, `relatorios` e `indicadores` já dependem de `applyFilters`/`FiltrosBar`, que usam `pickDateIso` (registro).

## Validação

- Selecionar um ano com propostas cujo evento cai no ano seguinte: a proposta deve aparecer no ano em que foi cadastrada, não no ano do evento.
- Na aba Indicadores, a tabela detalhada deve ordenar e exibir a coluna Data pela data de registro.
- Nenhuma mudança em `vendas-metrics.ts` (regra central) — permanece "sempre pela data de registro".
