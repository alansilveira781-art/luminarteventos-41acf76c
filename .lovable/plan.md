Plano de implementação:

1. Versionar a persistência dos filtros
- Trocar a chave do Dashboard Comercial de `comercial.dashboard.filtros.v1` para `comercial.dashboard.filtros.v2` em `src/routes/comercial.dashboard.tsx`.
- Manter a persistência ativa, apenas descartando o estado antigo salvo no navegador.

2. Sanitizar filtros inválidos após carregar os dados
- Ajustar o `useEffect` existente em `DashboardLayout` para revalidar o filtro sempre que os dados carregarem/mudarem.
- Se `filtros.ano` for diferente de `Todos` e não existir nos anos derivados por `getAno(rows)`, redefinir para `Todos` como destino seguro.
- Preservar os demais filtros quando forem válidos.

3. Evitar selects visualmente vazios
- Em `src/components/comercial/dashboard/FiltrosBar.tsx`, calcular valores seguros para cada select.
- Para `ano`, `empresa`, `consultor` e `classificacao`, se o valor atual não existir entre as opções disponíveis, renderizar o select com `Todos` selecionado.
- Continuar incluindo `Todos` e as opções reais derivadas dos dados.

4. Conferir lógica de métricas já corrigida
- Confirmar que `filtrosIniciais.ano = "Todos"` e que `applyFilters`, séries e comparações usam `getAno`, `getMes` e `getTrimestre`.
- Não trocar fonte de dados, não remover persistência e não alterar Estoque/Compras.

Validação:
- Abrir o Dashboard com localStorage antigo não deve mais zerar KPIs.
- Selects de Ano e Empresa devem aparecer com `Todos` ou opções válidas, nunca em branco.
- Selecionar ano com vendas deve filtrar corretamente.
- Atualizações em `comercial_vendas` continuam refletindo no Dashboard via query/realtime existente.