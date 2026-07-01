## Plano — Seção "Relatórios de Vendas"

Adicionar uma nova seção logo abaixo do painel atual em `src/routes/comercial.dashboard.index.tsx`, reaproveitando o contexto `useDashboard` (mesmos filtros Empresa/Ano/Mês, mesmos dados filtrados).

### Layout

```text
── Relatórios de Vendas ─────────────────────────────
[KPI Vendas Totais] [KPI Qtde] [KPI Desconto] [KPI Ticket]

┌────────────────────────────────────┬──────────────────────┐
│ Tabela detalhada (scroll x)        │ Comissões vendedores │
│  Data | Nome do Evento | Local |   │ (barras horizontais) │
│  Consultor | Decorador |            │                      │
│  Cerimonial | Valor Final          │                      │
│  ...                                │                      │
│  Total ................ R$ X,XX Mi │                      │
└────────────────────────────────────┴──────────────────────┘

┌──────────────────────┬──────────────────────┬─────────────┐
│ Ranking Cerimonial   │ Ranking Decorador    │ Real. VS    │
│ /Agência (barras h.) │ (barras horizontais) │ Meta (gauge)│
└──────────────────────┴──────────────────────┴─────────────┘
```

### Conteúdo

1. **Título** `<h2>` "Relatórios de Vendas" com um separador visual acima.

2. **4 KPIs** — reutilizar `KpiCard` e o objeto `k = kpis(filtered, previous)` já calculado. Mesmos títulos/ícones do topo (Vendas Totais, Quantidade de Vendas, Desconto, Ticket Médio).

3. **Tabela detalhada** (shadcn `Table` de `@/components/ui/table`):
   - Colunas: Data (`dataEvento` formatado `dd/MM/yyyy`), Nome do Evento, Local, Consultor, Decorador, Cerimonial, Valor Final (BRL alinhado à direita).
   - Ordenar por `dataEvento` desc.
   - Wrapper `overflow-x-auto`, altura máx `~420px` com `overflow-y-auto`.
   - `<TableFooter>` com linha "Total" e soma de `valorFinal` (BRL, colspan nas colunas anteriores).

4. **Comissões vendedores** — BarChart horizontal com `comissoesPorVendedor(filtered)` (já existe em `vendas-metrics`). Formato idêntico ao Ranking Consultores do painel atual (mesmo `hsl(var(--primary))`, LabelList em BRL).

5. **Ranking Cerimonial/Agência** — BarChart horizontal com `rankingCerimonial(filtered)` (`valor`).

6. **Ranking Decorador** — BarChart horizontal com `rankingDecorador(filtered)` (`valor`).

7. **Real. VS Meta** — reutilizar `<GaugeRealVsMeta valor={realizado} meta={metaPeriodo} />` (já calculado).

### Observações técnicas

- **Sem nova rota** — a seção fica no mesmo `comercial.dashboard.index.tsx`, abaixo do bloco atual. Os filtros do topo já valem para os dois blocos porque a fonte é o mesmo `filtered`.
- **Sem alterações no banco, no contexto, ou em `vendas-metrics.ts`** — todas as funções necessárias (`comissoesPorVendedor`, `rankingCerimonial`, `rankingDecorador`) já existem.
- **Imports novos** no arquivo: `Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell` de `@/components/ui/table`; `comissoesPorVendedor, rankingCerimonial, rankingDecorador` de `vendas-metrics`.
- **Sem títulos verticais**, seguindo padrão já estabelecido.
- Nenhuma alteração de estilo/design tokens.
