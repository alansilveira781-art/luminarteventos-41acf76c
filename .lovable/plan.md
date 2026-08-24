# Custo de operação — alinhar com o demonstrativo

Ajustar o gráfico "Custo de operação x Receita" para que a soma reproduza exatamente as linhas do demonstrativo (DRE) do painel.

## O que muda

O custo de operação passa a somar todos os grupos de saída do demonstrativo, exceto Outras Saídas:

- Potencial de Vendas: AC (Aquisição de Clientes) + DM (Marketing) + DC (Comerciais)
- Despesas: DS (Sócio) + DA (Administrativas) + DT (Tributárias)
- Custos: CV (Variáveis) + CD (Diretos) + CI (Indiretos)
- Novos: DR (Deduções da Receita) + DF (Despesas Financeiras) + IN (Investimentos)

Fica de fora apenas OS (Outras Saídas).

Os valores por grupo continuam vindo do mesmo cálculo que alimenta o demonstrativo da tela (mesma função, mesmo regime), então cada parcela do somatório bate linha a linha com o que aparece no DRE — ex.: DM 2.900,00 + DC 3.429,44 etc.

Para deixar isso verificável, o tooltip do gráfico passa a listar a composição do mês (cada grupo com seu valor) além do total e do percentual.

## Detalhes técnicos

- `src/lib/conta-azul/painel-analises.ts`: em `serieCustoOperacao`, incluir `DR`, `DF` e `IN` no somatório (mantendo `Math.abs` por grupo) e devolver também um `detalhe: { id, label, valor }[]` por mês.
- `src/components/financeiro/ContaAzulDashboard.tsx` (~linha 827): tooltip customizado do `ComposedChart` exibindo o detalhe por grupo; legenda/textos de apoio atualizados para citar os grupos somados.
- Nenhuma mudança de consulta, de banco ou do cálculo do DRE em si.
