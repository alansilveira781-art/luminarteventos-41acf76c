# Diaristas: lista vazia no apontamento + busca por nome

## Causa identificada (verificada no banco)

- As políticas de RLS das tabelas `diaristas`, `diarista_apontamentos`, `diarista_apontamento_eventos` e `diarista_fechamentos` exigem `has_module_access(auth.uid(), 'financeiro')`.
- O módulo `financeiro` foi **desativado** quando encerramos o módulo antigo de Despesas/Aquisições, e `has_module_access` só aceita módulos com `ativo = true`.
- Resultado: usuários do Financeiro Operacional (`financeiro_op`) não conseguem ler os diaristas — o Select do apontamento abre vazio.

## O que muda

### 1. Correção das permissões (migração)

Recriar as políticas abaixo trocando `has_module_access(...,'financeiro')` por `has_module_access(...,'financeiro_op')` (mantendo `is_admin` e as regras de lançador já existentes):

- `diaristas`: "Financeiro pode gerenciar diaristas" (SELECT/INSERT/UPDATE/DELETE).
- `diarista_apontamentos`: leitura, criação, edição e exclusão (4 policies).
- `diarista_apontamento_eventos`: "Acesso aos eventos conforme apontamento".
- `diarista_fechamentos`: leitura + 3 policies de admin (`is_module_admin(...,'financeiro')` → `financeiro_op`).

Sem mudança de regras para lançadores (`pode_lancar_diaria`), que já funcionam.

### 2. Seleção de diarista com busca

- Em `src/routes/financeiro-op.diaristas.index.tsx`, trocar o `Select` simples do campo **Diarista** no diálogo de apontamento pelo componente `SearchableSelect` (já existente no projeto): lista suspensa com campo de busca digitável (tolerante a acentos), exibindo apelido/nome.
- Mostrar todos os diaristas ativos; ao editar um apontamento cujo diarista foi inativado, ele continua selecionável (incluído nas opções).

## Detalhes técnicos

1. **Migração SQL**: `DROP POLICY ... ; CREATE POLICY ...` nas 4 tabelas, copiando as expressões atuais e trocando apenas o slug do módulo. Nenhuma alteração de GRANT ou estrutura.
2. **Frontend**: substituir o bloco `<Select>` do campo Diarista (linhas ~1104-1114) por `<SearchableSelect options={...} value onChange placeholder="Selecione" searchPlaceholder="Digite o nome…" />`, com opções `diaristasAtivos` + (se edição) o diarista atual.
3. Nenhuma outra tela alterada; filtros das abas Apontamento/Fechamento continuam como estão.
