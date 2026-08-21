# Lembretes — repetição só em dias úteis + navegação de dia na aba Hoje

## 1. Repetição apenas em dias úteis

No modal de tarefa, quando a recorrência for diferente de "Não se repete", aparece uma nova opção:

- Caixa de seleção **"Somente dias úteis (seg a sex)"**

Com ela marcada, ao gerar as ocorrências da série o sistema pula sábados e domingos. Exemplo: "a cada 2 dias, somente dias úteis" gera seg, qua, sex, ter, qui... sempre caindo em dia útil, nunca no fim de semana. O mesmo vale para semanal/mensal: se a data calculada cair no fim de semana, ela é empurrada para a segunda-feira seguinte.

O resumo em texto passa a mostrar "... — somente dias úteis", e a contagem de tarefas geradas continua respeitando o limite escolhido (N ocorrências / data limite / 1 ano).

Como as ocorrências já são criadas de verdade no momento de salvar, **nenhuma mudança no banco é necessária**.

## 2. Avançar e voltar dia na aba "Hoje"

A aba "Hoje" ganha uma barra de navegação no topo:

- Botão **‹** (dia anterior), a data por extenso no centro, botão **›** (próximo dia)
- Botão **Hoje** para voltar à data atual (aparece quando a data selecionada não é hoje)

A lista passa a mostrar as tarefas do dia selecionado (pendentes e concluídas), e o botão "+ Nova tarefa" já abre com essa data preenchida. O destaque vermelho de atraso continua valendo apenas para horários já vencidos.

## Detalhes técnicos

- `src/lib/lembretes.ts`: `gerarOcorrencias` recebe um parâmetro `somenteDiasUteis`; helper `proximoDiaUtil(d)` (sábado → +2, domingo → +1) aplicado a cada data gerada, com dedupe de datas repetidas; `descreverRecorrencia` ganha o sufixo correspondente.
- `src/components/lembretes/TarefaDialog.tsx`: novo estado `diasUteis` + `Checkbox`, repassado ao preview e ao `onSubmit` (`TarefaFormValues.somente_dias_uteis`, usado apenas na geração).
- `src/routes/lembretes.tsx`: `salvarTarefa` repassa a flag para `gerarOcorrencias`; `HojeView` recebe `dia`/`setDia` (estado no componente pai, padrão hoje) e filtra por `toDateKey(dia)` em vez de hoje fixo.
