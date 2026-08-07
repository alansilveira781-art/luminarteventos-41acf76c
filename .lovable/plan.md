# Diaristas: remover sub-linhas de eventos do relatório

## O que muda

No módulo **Financeiro > Diaristas > Fechamento** e no **PDF** gerado a partir dele, removemos as sub-linhas que detalham cada evento (as linhas com `↳`).

- A tabela de fechamento mostra apenas uma linha por dia: Data, Projeto/Evento, Local, Horário, Horas, Diária, Extra, Refeições e Total.
- O cálculo continua considerando o rateio por evento internamente para chegar ao total correto do dia; apenas a exibição das fatias some.
- O PDF acompanha a mesma simplificação.

## Detalhes técnicos

1. `src/lib/diaristas-pdf.ts`
   - Remover o loop que insere as sub-linhas de `it.eventos` no corpo da tabela.
   - Reajustar `columnStyles` para as colunas restantes (sem a coluna extra ocupada pelas sub-linhas).

2. `src/routes/financeiro-op.diaristas.index.tsx`
   - Remover a renderização das sub-linhas de eventos na tabela detalhada do Fechamento.
   - Manter o cálculo com `calcularApontamentoComEventos` e o `eventosMap` para garantir que o total do dia continue correto.

## Fora de escopo

- Não alterar o cálculo de horas/valores.
- Não mexer na aba Apontamento.
- Não alterar a configuração de refeições.
