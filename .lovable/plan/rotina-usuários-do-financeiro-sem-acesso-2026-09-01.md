# Rotina: usuários do Financeiro sem acesso

## Causa (verificada no banco)

Todas as políticas de permissão das tabelas de Rotina ainda exigem o módulo antigo `financeiro`, que foi **desativado** quando encerramos Aquisições. Como a função de checagem só aceita módulos ativos, ninguém do Financeiro Operacional consegue ler ou gravar:

- `financeiro_rotinas`
- `financeiro_rotina_atividades`
- `financeiro_rotina_execucoes` (leitura, criação, edição, exclusão)
- `financeiro_rotina_anexos` e `financeiro_rotina_execucao_anexos`
- Bucket de arquivos `rotina-anexos` (4 políticas de leitura/envio/edição/exclusão)

É exatamente o mesmo problema já corrigido em Diaristas.

## Correção

Uma migração que recria essas políticas trocando o módulo `financeiro` por `financeiro_op`, mantendo as demais regras (admin geral, admin do módulo para exclusão de execuções). Nenhuma mudança de estrutura, dados ou tela.

## Verificação

Com um usuário que tem apenas o módulo Financeiro Operacional: abrir `/financeiro-op/rotinas`, listar rotinas, criar/editar uma rotina, registrar uma execução e anexar um arquivo.
