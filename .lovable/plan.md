## Objetivo

Fazer com que os filtros globais do Dashboard Comercial (Empresa, Ano, Mês, Trimestre, Consultor, Classificação) realmente afetem TODAS as seções — inclusive Indicadores — e reduzir os filtros próprios da aba Indicadores para apenas os dois inputs de Ano A e Ano B.

## Mudanças em `src/routes/comercial.dashboard.index.tsx`

1. **Remover o reset forçado dos filtros globais**
   - Apagar o `useEffect` (linhas ~116-130) que zera `consultor`, `classificacao` e `trimestre` para "Todos" toda vez que mudam. Ele é o motivo dos filtros parecerem "fixos": qualquer seleção do usuário volta imediatamente para "Todos".
   - Depois disso, os filtros globais renderizados pelo `FiltrosBar` passam a valer em Painel, Relatório, Vendedores e Indicadores.

2. **Simplificar filtros da aba Indicadores**
   - Remover os states/UI locais de `indEmpresa`, `indTrimestre`, `indConsultor`, `indClassificacao` (inputs duplicados no topo da aba Indicadores).
   - Manter apenas os dois inputs numéricos: **Ano A** e **Ano B**.
   - Ajustar a chamada `compararAnos(rows, indAnoA, indAnoB, { ... })` para usar os valores dos filtros globais (`filtros.empresa`, `filtros.trimestre`, `filtros.consultor`, `filtros.classificacao`, `filtros.mes`) em vez dos states removidos.
   - Como `compararAnos` já recebe `ano A` e `ano B` explicitamente, o `filtros.ano` global é ignorado nessa aba (comportamento correto).

3. **Garantir Trimestre visível globalmente**
   - Passar `showTrimestre` (ou `fields`) ao `<FiltrosBar>` do topo do dashboard para que Trimestre apareça como filtro global — hoje só Empresa/Ano/Mês/Consultor/Classificação estão no default.

## Fora de escopo

- Nenhuma alteração em lógica de métricas, componentes de gráfico, layout de KPIs ou grade de botões de consultor da aba Vendedores.
- Nenhuma alteração em outras rotas ou no `FiltrosBar`.