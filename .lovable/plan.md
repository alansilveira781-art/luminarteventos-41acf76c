# Bonificação: coluna "Local" na tabela

## O que muda

Na aba Bonificação (Financeiro), a tabela de eventos ganha uma coluna **Local**, posicionada entre "Nome do evento" e "Data". Ela mostra o local cadastrado no evento do calendário; quando não houver, exibe "—".

A coluna aparece também na visão de mês fechado (tabela do fechamento) para manter o mesmo layout, e é incluída na impressão.

## Detalhes técnicos

- `src/components/financeiro/DistribuicaoBonificacao.tsx`:
  - adicionar `local: string | null` ao tipo `EventoBonif` e mapear `e.local` no `useMemo` de `eventos` (o hook `useEventosRealizados` já retorna `local`).
  - inserir `<th>Local</th>` após "Nome do evento" e a `<td rowSpan>` correspondente; ajustar os `colSpan` das linhas vazias/totais de 7 para 8.
  - na tabela do mês fechado, exibir o local quando disponível a partir dos itens do fechamento (usa o mesmo agrupamento por evento); se o dado não existir no fechamento salvo, mostrar "—".
- Sem mudanças de banco de dados.
