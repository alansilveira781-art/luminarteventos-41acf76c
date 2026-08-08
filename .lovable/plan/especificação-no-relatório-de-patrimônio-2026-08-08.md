# Especificação no relatório de Patrimônio

Hoje o relatório mostra apenas o nome do item. No inventário o item aparece como `NOME · Especificação`. Vamos aplicar o mesmo formato no relatório.

## O que muda

- A consulta do relatório passa a trazer também o campo de especificação de cada item.
- Na tabela da tela de relatórios, a coluna "Item" mostra `Nome · Especificação` (especificação em tom mais claro, como no inventário).
- No PDF exportado, a coluna "Item" também passa a incluir `Nome · Especificação`, com quebra de linha automática na célula.
- A busca da tela passa a considerar a especificação (igual ao inventário).

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`: adicionar `especificacao` ao tipo `Pat` e ao `select`; incluir no filtro de busca; renderizar na célula; enviar no mapeamento para o PDF.
- `src/lib/patrimonio/relatorio-pdf.ts`: adicionar `especificacao` em `RelatorioPatItem` e concatenar na coluna Item (`nome · especificacao`), mantendo a largura atual da coluna com `overflow: linebreak`.
