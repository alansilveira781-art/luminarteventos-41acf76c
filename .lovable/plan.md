## Trocar filtros globais pelos filtros de Indicadores ao selecionar a aba

Quando o usuário clicar na aba **Indicadores** do Dashboard Comercial, a barra global de filtros (Empresa / Ano / Mês) some e dá lugar à barra de filtros da própria seção (Ano A, Ano B, Empresa, Trimestre, Consultor, Classificação). Nas demais abas (Painel, Relatório, Vendedores) tudo continua exatamente como está hoje.

### Arquivo alterado
- `src/routes/comercial.dashboard.index.tsx`

### O que muda
1. O `<Card>` que renderiza a `FiltrosBar` global (linhas ~207–219) passa a ser renderizado apenas quando `secao !== "indicadores"`.
2. O `<Card>` de filtros específicos da seção Indicadores (Ano A/B, Empresa, Trimestre, Consultor, Classificação — linhas ~602–656) é movido para fora do bloco `secao === "indicadores"` e passa a ser renderizado no lugar da barra global sempre que `secao === "indicadores"`. Assim ele fica visualmente no mesmo local em que a barra global aparecia (topo, acima dos botões de aba).
3. O contador "X vendas carregadas · Y no filtro atual" continua aparecendo junto da barra global (só nas outras abas), já que nessa seção ele não faz sentido.
4. Nenhuma alteração em lógica de cálculo, estado ou dados — apenas condicional de renderização e reposicionamento do card de filtros.

### Fora de escopo
- Não altera `FiltrosBar`, `compararAnos` nem qualquer arquivo de métricas.
- Não altera as demais seções.
