# Exportar inventário de Patrimônio em PDF

## O que muda

No diálogo **Exportar relatório do inventário** (Patrimônio > Inventário), o campo **Formato** ganha a opção **PDF (relatório)**, ao lado de CSV e Excel.

O PDF respeita exatamente o que já está na tela do diálogo:

- Escopo escolhido (itens filtrados ou todos).
- Somente as colunas marcadas, na mesma ordem da lista.

Layout do PDF:

- A4 (retrato quando poucas colunas, paisagem automática quando muitas), padrão visual do Grupo Luminart.
- Cabeçalho: "Inventário de Patrimônio", escopo, quantidade de itens, soma de quantidade e valor total, e data/hora de geração.
- Tabela com cabeçalho repetido a cada página; valores em reais e datas formatados em pt-BR; colunas de número/valor alinhadas à direita.
- Linha de TOTAL ao final (quantidade e valor total) quando essas colunas estiverem marcadas.
- Rodapé com "Página X de Y".

## Detalhes técnicos

- Novo arquivo `src/lib/patrimonio/inventario-pdf.ts` exportando `gerarInventarioPdf({ titulo, escopo, colunas, linhas })`, usando `jspdf` + `jspdf-autotable` carregados sob demanda (mesmo padrão de `src/lib/comercial/vendas-relatorio.ts`).
- `src/routes/patrimonio.index.tsx` (`ExportDialog`): adicionar `"pdf"` ao estado `format`, novo `SelectItem`, e chamada assíncrona no `doExport` mantendo CSV/XLS inalterados.
- Orientação decidida pela quantidade de colunas selecionadas; larguras proporcionais calculadas a partir das colunas escolhidas.
- Sem mudanças de banco e sem alterar permissões.
