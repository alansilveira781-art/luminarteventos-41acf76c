Ajustar a visualização dos gráficos "Ranking Cerimonial/Agência" e "Ranking Decorador" na seção Relatório de Vendas para evitar que fiquem encolhidos quando há muitos itens.

### O que será alterado

No arquivo `src/routes/comercial.dashboard.index.tsx`, na seção `secao === "relatorio"`:

1. **Altura fixa por card**: Limitar a altura visível do card para comportar aproximadamente 5 itens (altura fixa ~200-240px), em vez de expandir proporcionalmente ao número de registros.
2. **Rolagem horizontal no gráfico**: Envolver o `ResponsiveContainer` / `BarChart` de cada ranking em um container com `overflow-x-auto` e definir uma largura mínima proporcional à quantidade de itens (por exemplo, `Math.max(400, dados.length * 90)`), garantindo que o gráfico role horizontalmente quando houver mais de 5 itens.
3. **Maior legibilidade**: Aumentar a altura das barras (`barSize` ~28-32), o espaçamento interno e a fonte dos labels/valores para que os valores de cada barra fiquem legíveis sem ficarem encolhidos.
4. **Aplicar nos dois rankings**: Repetir a mesma estrutura para "Ranking Cerimonial/Agência" e "Ranking Decorador".

### Resultado esperado

- Os cards de ranking terão tamanho consistente mostrando ~5 itens de cada vez.
- Quando houver mais de 5 itens, o gráfico permitirá rolar horizontalmente dentro do card.
- Os valores à direita de cada barra (Σ `valor_final`) ficarão legíveis, sem sobreposição ou encolhimento.

### Verificação

- Recarregar a rota `/comercial/dashboard` e alternar para a aba "Relatório de Vendas".
- Validar que os cards de Cerimonial/Agência e Decorador exibem scroll horizontal quando há muitos registros e que os valores são legíveis.