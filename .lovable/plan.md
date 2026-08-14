# Lembretes — agenda pessoal de atividades

Nova área pessoal dentro do Luminart, no mesmo espírito de "Meus Pedidos": cada usuário logado vê e gerencia **apenas as suas próprias** tarefas e projetos pessoais. Sem novo login, sem novo cadastro — usa a conta que a pessoa já tem.

Escopo desta entrega: base de dados + telas e CRUD (Prompts 1 e 2). Notificações do navegador e Web Push ficam para depois.

## Onde fica

Grupo "Visão geral" da barra lateral, logo abaixo de "Meus Pedidos":

- **Lembretes** → `/lembretes` (Hoje, Semana, Todas)
- **Projetos pessoais** → dentro da própria tela, como quarta aba

Visível para todo usuário logado, sem exigir módulo.

## Banco de dados

Duas tabelas novas, prefixadas para não colidir com o que já existe:

**lembretes_projetos** — nome, cor (padrão `#2C3E50`), ativo.

**lembretes_tarefas** — projeto (opcional), título, descrição, data/hora, dia inteiro, duração em minutos (30), lembrete em minutos antes (15), recorrência (nenhuma / diária / semanal / mensal), prioridade (baixa / normal / alta), status (pendente / concluída / cancelada), concluída em, notificada em.

Ambas com `user_id`, `created_at`, `updated_at`.

O fuso horário do prompt original entra como preferência do usuário na tabela de perfis já existente (campo `fuso_horario`, padrão `America/Fortaleza`) — não será criada uma segunda tabela de perfis.

**Acesso aos dados:** cada pessoa só consegue ver, criar, editar e excluir os próprios lembretes e projetos. Ninguém — nem administrador — enxerga a agenda de outra pessoa pela aplicação. O dono do registro é gravado automaticamente pelo banco no momento da criação, não pela tela.

## Telas

Cabeçalho com a data de hoje por extenso e botão "+ Nova tarefa" sempre visível. Visual sóbrio, sem gradientes e sem emoji, usando o tema atual do sistema.

**Hoje** (inicial)
- Tarefas pendentes de hoje, ordenadas por horário: horário, título, projeto com sua cor, checkbox
- Marcar o checkbox conclui a tarefa, grava a hora da conclusão e move o item para "Concluídas hoje", com texto riscado
- Pendentes com horário já vencido ganham destaque em vermelho
- Sem tarefas: mensagem discreta

**Semana**
Sete colunas (segunda a domingo) com as tarefas de cada dia e navegação para semana anterior/próxima.

**Todas**
Tabela com filtros de projeto, status e período, mais busca por texto no título. Colunas: data e hora, título, projeto, prioridade, status.

**Projetos**
Lista com criar, editar, ativar/inativar e excluir, com seletor de cor.

**Modal de tarefa** (mesmo para criar e editar)
Título, descrição, projeto, data, hora, "dia inteiro", duração, lembrete em minutos antes, recorrência e prioridade. Marcar "dia inteiro" esconde hora e duração. Título e data obrigatórios.

Recorrência é gravada como atributo da tarefa nesta etapa; a geração automática das próximas ocorrências não entra agora.

## Detalhes técnicos

- Rotas: `src/routes/lembretes.tsx` (layout com abas) + `lembretes.index.tsx`, `lembretes.semana.tsx`, `lembretes.todas.tsx`, `lembretes.projetos.tsx`
- Componentes em `src/components/lembretes/`: `TarefaDialog.tsx`, `TarefaItem.tsx`, `ProjetoDialog.tsx`
- Helpers de data/recorrência em `src/lib/lembretes.ts`
- React Query com `queryKey` próprio (`["lembretes", ...]`), estados de carregando e erro em cada tela
- Migração SQL com as duas tabelas, GRANTs, RLS por dono, trigger de `updated_at` e trigger que preenche o dono na inserção
- Item novo no `allItems` de `src/components/AppSidebar.tsx`
- `head()` próprio na rota com título e descrição específicos
