## Ajustar enquadramento das pizzas "Ano A / Ano B" (Indicadores)

Os dois gráficos de pizza estão cortando rótulos e a legenda porque o raio é grande demais para a altura do card e os labels "R$ X Mi (YY%)" saem da área visível.

### Arquivo alterado
- `src/routes/comercial.dashboard.index.tsx` — bloco dos dois `PieChart` (linhas ~718–754).

### Ajustes visuais
1. **Altura do card**: aumentar de `h-80` para `h-96` para dar folga vertical aos rótulos.
2. **Pie**:
   - `cx="38%"` e `cy="50%"` (mantém pizza à esquerda, legenda à direita).
   - `outerRadius={90}` (reduz para caber com labels externos).
   - `labelLine={true}` com labels externos (`R$ 2,6 Mi · 34%`) formatados em uma única linha usando espaço inquebrável.
   - Filtrar fatias com valor `0` para não poluir.
3. **Legend**: `align="right"` `verticalAlign="middle"` `wrapperStyle={{ fontSize: 12, maxWidth: "45%", lineHeight: "18px" }}` para as classificações longas quebrarem corretamente sem invadir a pizza.
4. **Margem do PieChart**: `margin={{ top: 8, right: 8, bottom: 8, left: 8 }}` para o label não colar na borda do card.

Nenhuma alteração de dados, cálculo ou estado — apenas propriedades de layout dos componentes Recharts.
