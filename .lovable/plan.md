## Nova seção "Indicadores" (Ano A vs Ano B)

Adicionar um 4º botão de seção no Dashboard Comercial (`/comercial/dashboard`), ao lado de "Painel de Vendas", "Relatório de Vendas" e "Vendedores".

### Filtros próprios da seção
Barra de filtros independente (não usa a `FiltrosBar` global do topo):
- **Ano A** e **Ano B** — dois inputs numéricos (default: ano atual e ano anterior).
- **Empresa**, **Trimestre**, **Consultor**, **Classificação** — selects populados a partir de `rows`.

Os filtros de topo (Empresa/Ano/Mês) continuam visíveis mas são ignorados nesta aba — a aba usa apenas seus próprios filtros para garantir a comparação limpa entre os dois anos.

### Componentes da seção

1. **Linha Ano A vs Ano B**
   - `LineChart` com 2 séries (`anoA`, `anoB`), eixo X = trimestres (1º–4º).
   - Cores distintas (azul claro / azul escuro) + legenda + labels de valor abreviado (R$ 2,6 Mi).

2. **Tabela comparativa**
   - Linhas: Vendas totais, Qtde de vendas, Ticket médio, Desconto total.
   - Colunas: Indicador, Ano A, Ano B, % variação.
   - % colorida: verde se ≥ 0, vermelho se < 0.

3. **Pizzas lado a lado**
   - Dois `PieChart` (Recharts), um por ano, distribuição de `valor_final` por `classificacao`.
   - Rótulo em cada fatia com valor abreviado e percentual (ex: "3,54 Mi (34,37%)").
   - Legenda lateral com a lista de classificações.

### Reuso de código
Já existe em `src/lib/comercial/vendas-metrics.ts` a função `compararAnos(rows, anoA, anoB, baseFilters)` que retorna `serie`, `tabela`, `pizzaA`, `pizzaB` e os KPIs — será usada diretamente sem duplicar lógica.

### Arquivos alterados
- `src/routes/comercial.dashboard.index.tsx` — adicionar `secao === "indicadores"`, novo botão de toggle, estado local dos filtros da seção e a UI (linha, tabela, pizzas).

Nenhuma alteração de banco de dados ou de contexto global.
