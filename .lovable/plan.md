Objetivo: Ajustar o gráfico comparativo do relatório **Vendas por Período** (Comercial › Relatórios).

Alterações em `src/components/comercial/RelatorioVendasPeriodo.tsx`:

1. **Importar `LabelList` do Recharts** ao lado dos demais componentes do gráfico.
2. **Adicionar rótulos de dados** nas barras de cada período usando `<LabelList position="top" formatter={...} />` dentro de cada `<Bar>`.
   - Formatter: `fmtAbrev` para manter a leitura compacta (ex.: R$ 12,5 Mil).
   - Fonte pequena (`fontSize: 11`) e cor adequada para legibilidade.
3. **Mudar cores das barras**:
   - Período A: preto sólido (`#000000`).
   - Período B: cinza escuro (`#4B5563` / gray-700).
4. **Manter legendas** (os labels `labelA` e `labelB` já existentes) e a estrutura do componente.

Não alterar: dados, rankings, filtros, exportação, impressão, outras abas ou módulos.

Arquivo único: `src/components/comercial/RelatorioVendasPeriodo.tsx`.