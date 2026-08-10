# Rotinas Financeiras: várias atividades por rotina

## O que muda

Hoje cada rotina aceita apenas uma atividade. Passa a aceitar várias.

- No formulário de rotina, o campo "Atividade" vira uma seleção múltipla: marca-se quantas atividades quiser, e as escolhidas aparecem como etiquetas removíveis.
- Abaixo da seleção, os descritivos de todas as atividades escolhidas aparecem em uma lista de leitura (título + passo a passo), para conferência.
- Na tabela de rotinas, mostra as etiquetas de todas as atividades vinculadas (com "+N" quando forem muitas).
- No detalhe/execução da rotina, lista todas as atividades com seus descritivos, para quem for executar.
- Rotinas já existentes continuam funcionando: a atividade única atual passa a ser a primeira da lista.

## Detalhes técnicos

- Migração: nova tabela de vínculo `financeiro_rotina_atividades` (`rotina_id`, `atividade_id`, `ordem`, timestamps), com chave única (`rotina_id`, `atividade_id`), GRANTs e RLS espelhando as regras já usadas em `financeiro_rotinas` (leitura para autenticados; escrita para admin global ou admin do módulo financeiro), e `on delete cascade` para a rotina e para a atividade.
- Migração: backfill copiando `financeiro_rotinas.atividade_id` para a nova tabela. A coluna `atividade_id` permanece por compatibilidade e passa a ser gravada com a primeira atividade selecionada.
- Código: as duas telas são cópias quase idênticas e recebem as mesmas mudanças — `src/routes/financeiro.rotinas.tsx` e `src/routes/financeiro-op.rotinas.tsx`.
- Nova consulta com chave de cache própria (`financeiro-rotina-atividades`), sem reaproveitar a chave da lista de rotinas; invalidada ao salvar/excluir rotina.
- Salvamento da rotina: após gravar a rotina, sincroniza os vínculos (remove os desmarcados, insere os novos) preservando a ordem de seleção.

## Verificação

Criar uma rotina com 3 atividades, salvar, reabrir e confirmar as 3 marcadas com os descritivos; conferir as etiquetas na tabela e a lista na execução; abrir uma rotina antiga e confirmar que a atividade original continua vinculada.
