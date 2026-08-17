# Lembretes — editar e excluir séries sem travar a tela

## O problema do travamento

Ao editar um lembrete que se repete, a tela abre uma segunda janela ("Somente esta / Esta e as próximas") por cima da janela de edição que continua aberta. Quando a segunda janela fecha, a página fica com o clique bloqueado — nada mais responde e só volta ao normal atualizando o navegador. Não é erro de banco: as permissões de editar/excluir estão corretas.

Correção: fechar a janela de edição antes de abrir a pergunta de escopo, e garantir que a página volte a aceitar cliques ao fechar qualquer uma das janelas.

## Escolha de escopo com três opções

Ao **editar** ou **excluir** um lembrete que faz parte de uma repetição, a pergunta passa a ter:

- **Somente esta** — afeta apenas a ocorrência aberta
- **Esta e as próximas** — afeta a ocorrência aberta e todas as futuras da série
- **Toda a série** — afeta todas as ocorrências, inclusive as passadas
- **Cancelar**

## Editar impactando a programação

Se, ao editar, a frequência for alterada (tipo de repetição, "a cada N", quantidade de vezes ou data limite) e o escopo for "Esta e as próximas" ou "Toda a série", o sistema **regenera a programação**: apaga as ocorrências do escopo escolhido e cria as novas datas conforme a nova regra, mantendo o mesmo identificador de série. As ocorrências já concluídas de datas passadas não são apagadas quando o escopo é "Esta e as próximas".

Se a frequência não mudou, apenas os dados (título, descrição, projeto, hora, duração, lembrete, prioridade) são aplicados no escopo escolhido, preservando as datas de cada ocorrência.

Após salvar ou excluir, uma mensagem informa o que aconteceu (ex.: "12 ocorrências atualizadas", "8 ocorrências excluídas").

## Excluir a série inteira em um clique

Na listagem, tarefas de série continuam com o selo de repetição; o botão de excluir passa a oferecer as mesmas três opções acima, para apagar a ocorrência ou a série toda.

## Detalhes técnicos

- `src/routes/lembretes.tsx`:
  - `EscopoSerie` passa a ser `"esta" | "futuras" | "todas"`; `AlertDialog` com três ações.
  - `pedirEscopoOuSalvar` / `pedirEscopoOuExcluir` fecham `tarefaDialog` antes de setar `escopoDialog` (evita Dialog+AlertDialog aninhados e o `pointer-events: none` residual no `body`); `onOpenChange` do AlertDialog limpa o estado, e um efeito de segurança remove `document.body.style.pointerEvents` ao fechar.
  - `salvarTarefa`: detecta mudança de recorrência comparando `recorrencia`, `recorrencia_intervalo`, `recorrencia_fim`, `recorrencia_qtd` com a tarefa atual. Se mudou → `delete` no escopo (`.eq("serie_id", ...)` + `.gte("data_hora", atual.data_hora)` para "futuras") seguido de `insert` em lote via `gerarOcorrencias`, reaproveitando `serie_id`. Se não mudou → `update` dos campos comuns no escopo.
  - `excluirTarefa`: escopo "todas" remove o filtro `.gte`, "futuras" mantém.
  - Mutations retornam a contagem afetada para o toast.
- Sem alteração de banco de dados nem de políticas de acesso.
