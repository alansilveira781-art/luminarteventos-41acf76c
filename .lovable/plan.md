# Prévia do dia ao lado do calendário na Rotina

## O que muda

Na aba **Calendário** da tela Rotina (`/financeiro-op/rotinas`), clicar em um dia abre uma **prévia do dia** ao lado do calendário, mostrando o que precisa ser feito:

- **Dia selecionado**: contorno/destaque na célula clicada (padrão: hoje).
- **Painel lateral** (à direita no desktop, abaixo no mobile) com:
  - Data por extenso (ex.: "terça-feira, 1 de setembro de 2026");
  - Lista das rotinas previstas no dia, ordenadas por horário: horário, título, responsável e descrição (quando houver);
  - Botão "Editar" em cada item (abre o mesmo modal de edição atual);
  - Mensagem discreta quando o dia não tem rotinas.
- Clicar numa rotina na grade continua abrindo a edição; clicar no dia (área vazia da célula) seleciona o dia para a prévia.

Sem mudança de banco de dados — reaproveita as rotinas já carregadas pela tela.

## Detalhes técnicos

- Arquivo: `src/routes/financeiro-op.rotinas.tsx`, componente `CalendarioRotinas` (linhas ~297–363).
- Novo estado `diaSel` (dia selecionado); layout vira `grid lg:grid-cols-[1fr_320px]`.
- As células já têm os eventos por dia via `buildMonthGrid(cursor, ativas)` — a prévia usa `cell.events` do dia selecionado.
- `onClick` da célula seleciona o dia; `stopPropagation` no clique da rotina para não trocar a seleção.

## Verificação

Abrir Rotina → Calendário, clicar em dias com e sem rotinas e conferir a prévia ao lado com horário/título; clicar em "Editar" no painel abre o modal da rotina.
