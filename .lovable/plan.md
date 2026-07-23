Ajustar os cards de indicadores em `src/routes/dashboard.tsx`:

1. **"Disponível" vira contagem de itens, não soma de quantidade**
   - Trocar o cálculo atual (linhas 212-213), que faz `reduce` somando `quantidade_atual`, por `itens?.filter((i) => i.status === "disponivel").length ?? 0`.
   - Assim o card mostra quantos itens têm estoque disponível (ex.: 4.848 → um número compatível com "Total de itens"), em vez do somatório de unidades (96045.4599).

2. **Formatar números com separador de milhar (pt-BR)**
   - No componente `Kpi` (linha 593), formatar `value` quando for numérico: `typeof value === "number" ? value.toLocaleString("pt-BR") : value`.
   - Isso passa 4848 → "4.848", 3678 → "3.678", 294 → "294", e mantém strings/labels inalterados. Aplica-se automaticamente a todos os cards (Total, Disponível, Baixo, Sem, Manutenção, Entradas, Saídas, Devoluções, Pendentes).

Sem outras mudanças de lógica ou layout.