# Cores harmônicas nos gráficos do módulo financeiro

Trocar as cores atuais (azul, verde, laranja, rosa, roxo, vermelho — sem relação com a marca) por uma paleta grafite + âmbar, alinhada à logo monocromática da Luminart e à interface em tons neutros.

## Paleta

Sequência de séries (categorias), do mais escuro ao mais claro, com âmbar como acento:

```text
1  #1a1a1a  grafite
2  #d99b2b  âmbar (acento da marca)
3  #4a4a4a  cinza escuro
4  #8a8a8a  cinza médio
5  #b07d22  âmbar escuro
6  #6b6b6b  cinza
7  #e8bd6b  âmbar claro
8  #a8a8a8  prata
9  #cfcfcf  prata claro
```

Cores semânticas (usadas onde o gráfico compara entrada x saída):
- Positivo / receita / recebimento: `#2f6b4f` (verde grafite dessaturado)
- Negativo / despesa / pagamento: `#9b3b2f` (terracota dessaturada)
- Neutro / meta / linha de referência: `#8a8a8a`

## O que muda

- Painel Financeiro: pizza de receitas, barras horizontais de Custos Variáveis e as cores da legenda no PDF exportado.
- Indicadores de Eventos: barras Receita / Custos / Despesas / Lucro passam a usar as cores semânticas + âmbar para lucro.
- Fluxo de Caixa: barras Receber/Pagar e a barra de saldo usam as cores semânticas.
- Uber (dashboard e análises): barras e linhas passam para grafite/âmbar.

Nenhuma lógica de cálculo, filtro ou consulta é alterada — só a apresentação.

## Detalhes técnicos

- Criar `src/lib/financeiro/chart-colors.ts` exportando `CHART_SERIES` (array de 9 hex), `CHART_POSITIVE`, `CHART_NEGATIVE`, `CHART_NEUTRAL` e um helper `serieColor(i)`.
- Substituir `PIE_COLORS` em `src/components/financeiro/ContaAzulDashboard.tsx` pelo import de `CHART_SERIES`, e os `fill` fixos (`#f97316`, `#10b981`, `#ef4444`) pelas constantes.
- Fazer a mesma substituição em `src/components/financeiro/IndicadoresEventos.tsx`, `UberDashboard.tsx` e `UberAnalises.tsx`.
- O PDF (`src/lib/conta-azul/painel-pdf.ts`) já recebe as cores prontas via `cor:` das fatias, então herda a paleta automaticamente; conferir se há hex fixo no arquivo e ajustar.
- Verificação: abrir o Painel Financeiro no preview e conferir pizza, barras e o PDF gerado.
