# Relatórios de Diaristas — totais por evento

Na aba **Relatórios** (Financeiro Operacional › Diaristas), o detalhamento deixa de ser dia a dia e passa a ser **por evento/projeto, somado por pessoa**, sempre respeitando o período (ex.: a semana) escolhido nos filtros.

## Como vai ficar

- Cada diarista continua com sua linha de resumo (dias, horas, total a pagar).
- Ao expandir, em vez de uma linha por dia, aparece **uma linha por evento**, com:
  - Nome do evento/projeto
  - Quantidade de dias trabalhados naquele evento
  - Total de horas somadas
  - Valor total somado
- Dias em que a pessoa trabalhou em mais de um evento entram rateados: cada evento recebe apenas a sua fatia de horas/valor (a soma das fatias continua igual ao valor do dia).
- Dias sem evento informado são agrupados como "Sem evento".
- A aba **Fechamento** continua exatamente como está hoje (detalhe por dia).

## Exportações da aba Relatórios

- **PDF**: a tabela de detalhe passa a listar eventos (Evento · Dias · Horas · Valor) em vez de datas.
- **Excel**: a aba "Detalhe" passa a ser "Por evento" (Diarista, Evento, Dias, Horas, Total).
- **CSV**: mantém o resumo por pessoa, sem alteração.

## Detalhes técnicos

- Em `src/routes/financeiro-op.diaristas.index.tsx`, `FechamentoView` ganha uma prop `agruparPorEvento` (ativada só em `RelatoriosTab`).
- Ao montar os grupos, quando `agruparPorEvento` está ativo, cada apontamento é expandido em fatias: usa `calcularApontamentoComEventos(...).rateio` quando `modo_divisao !== "unico"`, senão uma única fatia com `projeto` e o total do dia; as fatias são somadas por nome de evento normalizado (trim, case-insensitive) dentro de cada diarista.
- Totais do topo (dias/horas/valor) não mudam — continuam vindo do cálculo por dia, evitando dupla contagem.
- `src/lib/diaristas-pdf.ts` recebe um tipo de item alternativo (evento/dias/horas/valor) e o gerador escolhe as colunas conforme o modo; nenhuma mudança no banco.
