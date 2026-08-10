# Categoria no relatório de Vendas (PDF)

Hoje o relatório em PDF da aba Vendas mostra Data, Evento, Local/Cidade, Empresa, Consultor, Cerimonial e os valores. A classificação (Stand, Social, Cenografia, etc.) já é enviada para o gerador, mas não aparece em nenhuma coluna. O ajuste torna essa categoria visível por evento/projeto e reorganiza a tabela para caber corretamente na folha A4 paisagem.

## O que muda

1. **Coluna "Categoria"** na tabela principal, logo após o nome do evento — assim cada evento/projeto mostra sua classificação.
2. **Resumo por categoria**: novo bloco no fim do relatório, com quantidade de vendas, valor final, comissão e participação (%) de cada categoria (Stand, Social, Cenografia...), ordenado por valor.
3. **Ajuste de layout para caber na folha**:
   - Recalcular as larguras das colunas para somarem exatamente a área útil da página (sem estouro à direita).
   - Reduzir levemente a fonte da tabela e permitir quebra de linha nos textos longos (Evento, Local/Cidade).
   - Encolher Local/Cidade, Consultor e Cerimonial para abrir espaço à nova coluna, mantendo as colunas de valores legíveis e alinhadas à direita.
   - Ajustar o `colSpan` da linha TOTAL para acompanhar a nova quantidade de colunas.
4. **Exportação CSV** também passa a manter a Classificação junto ao evento (a coluna já existe; garantir posição coerente com o PDF).

## Detalhes técnicos

- Arquivo principal: `src/lib/comercial/vendas-relatorio.ts` (o campo `classificacao` já faz parte de `VendaRelatorioLinha`, apenas não é renderizado).
- A soma de `columnStyles.cellWidth` passará a bater com `pageW - marginX * 2` (~273 mm), evitando corte.
- O resumo por categoria usa a mesma estrutura de agregação já usada no resumo por consultor.
- Chamada em `src/routes/comercial.vendas.tsx` permanece igual (já envia `classificacao`).
