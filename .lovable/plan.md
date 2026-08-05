# Diaristas: exportação em PDF (relatório)

## O que muda

Na aba **Financeiro > Diaristas > Fechamento**, o menu **Exportar** ganha a opção **PDF (relatório)**, ao lado de Excel e CSV.

O PDF respeita exatamente os filtros da tela (período, local, diarista) e sai em A4 retrato com:

- Cabeçalho: título "Relatório de Diaristas", período (de/até), filtros aplicados e data/hora de geração.
- Um bloco por pessoa:
  - Linha de destaque com **nome do diarista**, chave Pix, quantidade de dias, total de horas e **valor total a pagar** em evidência.
  - Logo abaixo, o **descritivo do que ele fez no período**: tabela com Data, Projeto/Evento, Local, Horas, Diária, Extra e Total de cada dia.
  - Quando o dia foi dividido entre dois ou mais eventos, cada evento aparece como sub-linha com sua parte de horas e valor.
- Rodapé por página com numeração, e ao final um **Total geral** (dias, horas e valor).

Blocos não são cortados no meio da página: se não couber, a pessoa começa na página seguinte.

## Detalhes técnicos

- Novo arquivo `src/lib/diaristas-pdf.ts` com `gerarRelatorioDiaristasPdf({ periodo, filtros, grupos, totais })`, usando `jspdf` + `jspdf-autotable` carregados sob demanda (mesmo padrão de `src/lib/rh/ficha-pdf.ts`).
- `src/routes/financeiro-op.diaristas.index.tsx` (`FechamentoTab`): adicionar `DropdownMenuItem` "PDF (relatório)" chamando o gerador com as `linhas` já calculadas (inclui `itens` com `calc`).
- Sem mudanças de banco e sem alterar as exportações Excel/CSV existentes; o PDF continua restrito a quem vê a aba Fechamento (admins do Financeiro).
