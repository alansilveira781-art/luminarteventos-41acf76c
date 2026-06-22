Em `src/routes/dashboard.tsx`:

1. Importar `isAjusteMovimentacao` de `@/lib/utils`.
2. Garantir que as queries que alimentam contagem/gráfico tragam `entrada_tipo`, `saida_tipo`, `observacoes`, `finalidade` e `tipo`.
3. Aplicar `!isAjusteMovimentacao(m)` nos pontos:
   - KPI `entradasMes`.
   - KPI `saidasMes`.
   - Gráfico mensal de entradas vs saídas (`graficoMensal`).
   - Tabela ABC e qualquer outra agregação de entrada/saída que já filtra por tipo.

Não altera `movimentacoes`, saldo, triggers, reconciliação nem a regra `isAjusteMovimentacao`. Mudança apenas visual/contagem no Dashboard.