# Regra da diária mínima de 8h ligável/desligável

## O que muda

No diálogo de lançamento de diária entra um botão (switch) **"Garantir diária de 8h"**, ligado por padrão:

- **Ligado** (como hoje): mesmo trabalhando menos de 8h, paga a diária cheia (valor/hora x 8); acima de 8h, paga as horas excedentes.
- **Desligado**: paga estritamente as horas trabalhadas (valor/hora x horas), sem mínimo garantido.

O resumo do cálculo no diálogo reflete a escolha na hora. A regra fica gravada em cada lançamento, então listagem, fechamento e PDF usam sempre a regra escolhida naquele dia — lançamentos antigos continuam com a regra atual (ligada).

Refeições (almoço/janta), extra manual e o rateio entre eventos continuam funcionando igual.

## Detalhes técnicos

1. Banco: `diarista_apontamentos` ganha `diaria_minima boolean not null default true`.
2. `src/lib/diaristas-calc.ts`: `ApontamentoInput` recebe `diaria_minima?: boolean | null`; em `montarResultado`, quando falso, `diaria = horasTrab * valorHora` (sem piso de 8h). Padrão continua `true` quando o campo vier nulo/indefinido.
3. `src/routes/financeiro-op.diaristas.index.tsx`: switch no formulário (default `true`), persistência no insert/update, e o campo incluído no select e nos objetos passados ao cálculo na listagem e no fechamento.
4. Sem mudança no PDF nem nas exportações — os totais já vêm do cálculo.
