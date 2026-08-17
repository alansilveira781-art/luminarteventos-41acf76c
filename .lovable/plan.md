# Ajuste de layout do gráfico de Custos Variáveis no Painel Financeiro

Ajustar o Painel Financeiro (aba Dashboard > Financeiro (Conta Azul)) para que o gráfico de barras horizontais **Custos Variáveis (CV)** fique totalmente visível, sem cortes, e empurre as demais seções (Faturamento, DRE e Lançamentos) para baixo conforme necessário.

## Como vai funcionar

- O gráfico de CV deve exibir todas as categorias do período sem truncar barras ou rótulos.
- O card do gráfico de CV poderá crescer verticalmente sem ser limitado pela coluna vizinha (gráfico de pizza de Receitas).
- As seções seguintes (Faturamento x Recebimento, DRE e Lançamentos) descem naturalmente na página.
- Nenhum dado ou cálculo é alterado; apenas o layout e as alturas dos containers.

## Detalhes técnicos

Arquivo: `src/components/financeiro/ContaAzulDashboard.tsx`.

- Alterar o card do gráfico de CV para não depender de `h-[260px]` fixo quando houver muitas categorias.
- Usar altura dinâmica baseada na quantidade de fatias (`cvFatias.length`), com espaçamento confortável entre as barras.
- Garantir que o `ResponsiveContainer` do Recharts acompanhe a altura real do card.
- Ajustar o grid `lg:grid-cols-2` dos gráficos para que os cards não forcem altura igual entre si (evitar cortar o card maior).
- Manter o gráfico de pizza de Receitas inalterado em comportamento, apenas alinhado visualmente.
- Verificar se o texto analítico abaixo de cada gráfico continua legível após a expansão.

## Validação

- Abrir o Painel Financeiro em um mês com muitas categorias de CV (ex.: o período da imagem enviada).
- Confirmar que todas as barras do gráfico aparecem, sem scroll interno no card.
- Confirmar que as seções abaixo do gráfico deslizam para baixo e nada fica sobreposto.
