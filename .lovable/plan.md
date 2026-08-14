# Lembretes — repetição com quantidade ou data limite

Hoje a recorrência (diária / semanal / mensal) é apenas um rótulo salvo na tarefa: nenhuma ocorrência futura é criada, então a tarefa aparece só uma vez. A ideia é permitir dizer **de quanto em quanto tempo** a tarefa se repete e **até quando** (número de vezes ou data final), gerando as ocorrências de verdade.

## Como fica no modal de tarefa

Ao escolher uma recorrência diferente de "Não se repete", aparecem:

- **A cada N** dias / semanas / meses (padrão 1)
- **Termina**: uma escolha entre
  - Depois de **N ocorrências** (padrão 10)
  - Em uma **data limite**
  - Nunca (nesse caso o sistema cria 1 ano de ocorrências, para não gerar infinito)
- Um resumo em texto: "Toda semana, 10 vezes — até 20/10/2026".

Limite de segurança: no máximo 200 ocorrências por série.

## O que acontece ao salvar

**Criando** uma tarefa repetida: são criadas todas as ocorrências de uma vez, cada uma com sua data/hora, todas marcadas como parte da mesma série. Assim elas aparecem normalmente em Hoje, Semana, Calendário e Todas, e cada uma pode ser concluída de forma independente.

**Editando** uma tarefa que faz parte de uma série: pergunta "Aplicar somente nesta tarefa ou nesta e nas seguintes?".

**Excluindo**: mesma pergunta — só esta ou esta e as futuras.

Na lista/calendário, tarefas de série ganham um selo discreto de repetição com a descrição da frequência.

## Banco de dados

Novas colunas em `lembretes_tarefas`:

- `serie_id` (identificador da série; nulo em tarefas avulsas)
- `recorrencia_intervalo` (inteiro, padrão 1)
- `recorrencia_fim` (data limite, opcional)
- `recorrencia_qtd` (número de ocorrências, opcional)

As tarefas já existentes continuam funcionando sem alteração. As regras de acesso não mudam: cada pessoa segue vendo apenas os próprios lembretes.

## Detalhes técnicos

- `src/lib/lembretes.ts`: `gerarOcorrencias(dataInicial, recorrencia, intervalo, { qtd, ate })` com clamp de fim de mês (dia 31 → último dia do mês), `descreverRecorrencia()` para o resumo, e novos campos nos tipos.
- `src/components/lembretes/TarefaDialog.tsx`: campos de intervalo/término + preview; `TarefaFormValues` ganha `recorrencia_intervalo`, `recorrencia_fim`, `recorrencia_qtd`.
- `src/routes/lembretes.tsx`: `salvarTarefa` faz insert em lote das ocorrências com `serie_id = crypto.randomUUID()`; edição/exclusão com escopo (`.eq("serie_id", ...)` + `.gte("data_hora", ...)`) via `AlertDialog` de escolha.
- Migração: `ALTER TABLE public.lembretes_tarefas ADD COLUMN ...` + índice em `(user_id, serie_id)`.
