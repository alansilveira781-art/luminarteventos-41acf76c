Ajustar o estado inicial do filtro de Mês no Painel Financeiro (componente `ContaAzulDashboard`) para que, ao abrir o dashboard, o mês selecionado seja o mês corrente (ex.: Julho) em vez de "Todos".

### O que será alterado
- Arquivo: `src/components/financeiro/ContaAzulDashboard.tsx`
- No componente `PainelFinanceiro`, a linha:
  ```tsx
  const [mes, setMes] = useState(0);
  ```
  será alterada para:
  ```tsx
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  ```
  (O índice 0 representa "Todos"; `getMonth() + 1` retorna 1 para Janeiro, 7 para Julho, etc.)

### Comportamento esperado
- Ao abrir a aba "Painel Financeiro", o seletor de Mês virá preenchido com o mês atual.
- Os KPIs e o DRE serão carregados automaticamente para o ano e mês correntes.
- O usuário continua podendo trocar manualmente para "Todos" ou outro mês.