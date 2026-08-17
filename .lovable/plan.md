# Diaristas: "Garantir diária de 8h" também arredonda para cima

Hoje o botão só age quando a pessoa trabalha menos de 8h (paga a diária cheia). Acima de 8h ele paga diária + horas extras avulsas.

## Novo comportamento

Com o botão ligado, o pagamento passa a ser sempre em diárias fechadas de 8h, arredondando para cima:

- 6h trabalhadas → 1 diária (como hoje)
- 8h → 1 diária
- 9h → 2 diárias
- 15h30 (08:00 às 23:30) → 2 diárias
- 17h → 3 diárias

Ou seja, nunca mais "horas a mais" soltas: completa a próxima diária.

Com o botão desligado nada muda: paga estritamente valor/hora × horas trabalhadas.

Refeições (almoço/janta) e o valor extra manual continuam somando por fora, e blocos de empreitada continuam sem gerar valor.

## Onde aparece

- Cálculo do dia no lançamento e no resumo.
- Fechamento semanal e relatórios em PDF (usam o mesmo cálculo, então acompanham automaticamente).
- O texto de apoio do switch passa a explicar: "Paga em diárias fechadas de 8h, arredondando para cima (ex.: 15h30 = 2 diárias)."

## Detalhes técnicos

- `src/lib/diaristas-calc.ts`, função `montarResultado`: com `diariaMinima`, `diaria = Math.max(1, Math.ceil(horasTrab / 8)) * valorHora * 8`; sem ela, mantém `horasTrab * valorHora`.
- O rateio entre eventos continua proporcional às horas de cada bloco, agora sobre o total já arredondado.
- Ajuste do texto do switch em `src/routes/financeiro-op.diaristas.index.tsx`.
- Sem mudanças de banco. Lançamentos antigos serão recalculados na exibição conforme a regra nova.
