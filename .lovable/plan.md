# Horário real (entrada e saída) nos diaristas

## Problema

Na aba Diaristas, a coluna **Horário** mostra sempre o horário genérico do dia (ex.: 08:00–17:00), mesmo quando o apontamento foi dividido por horários entre vários eventos. Nesses casos o horário exibido não corresponde ao que foi de fato registrado.

## O que muda

1. **Coluna Horário (aba Apontamento)**: quando o apontamento estiver dividido "por horários", passa a exibir a **primeira entrada** (menor hora inicial entre os eventos) e a **última saída** (maior hora final entre os eventos). Apontamentos sem divisão continuam mostrando o horário do dia.
2. **Aba Fechamento**: a tabela detalhada de cada diarista ganha a coluna **Horário**, com a mesma regra.
3. **Relatório PDF**: a tabela de itens ganha a coluna **Horário**, também com a mesma regra, e as larguras das colunas são reajustadas para o A4 não cortar nada.

## Detalhes técnicos

- Nova função utilitária em `src/lib/diaristas-calc.ts` (ex.: `intervaloExibicao(apontamento, eventos, modo)`) que retorna `{ inicio, fim }`:
  - modo `horarios` com eventos: menor `hora_inicial` e maior `hora_final` entre os eventos (tratando virada de meia-noite pela ordem cronológica dos registros).
  - demais casos: `hora_inicial` / `hora_final` do apontamento.
- `src/routes/financeiro-op.diaristas.index.tsx`: usar a função na célula de horário da aba Apontamento e adicionar a coluna nas linhas detalhadas do Fechamento; passar `horarioLabel` para o PDF.
- `src/lib/diaristas-pdf.ts`: adicionar `horarioLabel` em `RelatorioItem`, incluir a coluna no `head` e nas linhas, e ajustar `columnStyles`.
- Sem alteração de banco de dados; apenas exibição.
