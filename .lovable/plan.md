## Adicionar relatório "Vendas por Período" em Comercial › Relatórios

Novo relatório comparativo entre dois intervalos de datas, ao lado do atual "Distribuição de Comissão".

### Arquivos

**1. Criar `src/components/comercial/RelatorioVendasPeriodo.tsx`**
- Recebe `rows`, `isLoading`, `error` como props (reutiliza dados já carregados via `listVendasDb`).
- Estado: 4 datas (Período A início/fim, Período B início/fim). Padrão: Jan–Jun ano atual vs Jan–Jun ano anterior.
- Filtra `rows` por `dataRegistro` (fallback `dataEvento`) dentro de cada intervalo.
- Renderiza:
  - Card de filtros com 4 inputs `type="date"` + botão Exportar CSV.
  - 3 KPIs comparativos (Qtd vendas, Valor final, Ticket médio) com variação % A vs B.
  - Gráfico de barras (recharts) comparando totais A vs B.
  - 4 rankings comparativos (Categoria, Vendedores, Cerimonial, Decorador) — top 10, tabela com colunas A e B, usando `valorPorClassificacao`, `rankingConsultor`, `rankingCerimonial`, `rankingDecorador` já existentes em `vendas-metrics.ts`.
- Exportação CSV com resumo + os 4 rankings.

**2. Editar `src/routes/comercial.relatorios.tsx`**
- Adicionar estado `relatorioAtivo: "comissao" | "periodo"` (padrão `"comissao"`).
- Importar `CalendarRange` do lucide-react e o novo componente `RelatorioVendasPeriodo`.
- Transformar a barra de seletor de relatório em 2 botões (variant muda conforme ativo): "Distribuição de Comissão" e "Vendas por Período".
- Envolver TODO o conteúdo atual (filtros Ano/Mês, cards de resumo, tabela agrupada por consultor) em `{relatorioAtivo === "comissao" && (<>…</>)}`.
- Renderizar `<RelatorioVendasPeriodo rows={rows} isLoading={isLoading} error={error} />` quando `relatorioAtivo === "periodo"`.

### Regras respeitadas

- Não altera o relatório de Distribuição de Comissão — apenas envolve em condicional.
- Não altera `listVendasDb`, `vendas-metrics.ts`, schema ou RLS.
- Reutiliza a mesma query `useQuery(["comercial-vendas-db", "relatorios"])`.
- Categoria = `classificacao` (via `valorPorClassificacao`).
