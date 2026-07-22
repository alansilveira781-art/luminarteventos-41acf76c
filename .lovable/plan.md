## O que mudar

No diálogo do Calendário de Eventos (aberto ao clicar em um card), cada um dos três blocos coloridos — **Evento**, **Montagem** e **Desmontagem** — passa a exibir também os horários informados no cadastro, além das datas que já aparecem hoje.

Formatos:

- **Evento**: `21/04/2026 08:00 → 20/07/2026 22:00` (usa `hora_inicio` e `hora_fim`). Se for o mesmo dia: `21/04/2026 08:00 → 22:00`. Sem horário: mantém só as datas.
- **Montagem**: `20/04/2026 07:00` (data + `hora_montagem`). Se houver `data_montagem_fim`: `20/04/2026 07:00 → 21/04/2026`.
- **Desmontagem**: `20/07/2026 22:00` (data + `hora_desmontagem`). Idem para intervalo.

Quando qualquer horário estiver vazio no cadastro, o bloco continua exibindo apenas as datas (comportamento atual), sem "—:—".

## Onde mexer (detalhes técnicos)

- `src/routes/calendario-publico.tsx`
  - Ampliar o `select` da query `eventos-publico` para incluir `hora_inicio` e `hora_fim` (hoje já traz `hora_montagem` e `hora_desmontagem`, mas não os do evento).
  - Adicionar helper local `fmtRangeComHora(inicio, fim, horaInicio, horaFim)` que anexa `HH:mm` quando existir e colapsa para "mesmo dia" quando `inicio === fim`.
  - Substituir os 3 `fmtRange(...)` dos blocos Evento / Montagem / Desmontagem pelas novas chamadas com horário.
- Tipo local `EventoCal` no arquivo: acrescentar `hora_inicio?: string | null` e `hora_fim?: string | null`.

Nenhuma alteração no banco, no Gantt ou em outras rotas.
