# Operação (Quadro de Produção) + Estoque (Dashboard e Relatórios)

## 1. Voltar card para um setor anterior

Hoje mover o card para trás não atualiza o roteiro (o setor de destino continua marcado como concluído e o progresso não volta), e qualquer responsável de setor consegue fazer isso.

- Só administradores (globais ou do módulo Operação) podem mover um card para um setor anterior. Usuários comuns só avançam para o próximo setor do roteiro.
- Ao voltar, o roteiro é corrigido: o setor de destino volta a "em andamento" (limpando a data de conclusão) e todos os setores posteriores voltam para "pendente", com datas limpas — assim o progresso e as etiquetas do card refletem a realidade.
- Registro no histórico da ordem de que houve retorno de setor.

## 2. Responsável por etapa do checklist

- Nova coluna de responsável nos itens de checklist (`op_ordem_checklist.responsavel_id`).
- Dentro do card, cada linha do checklist ganha um seletor compacto de pessoa (lista de usuários), editável por quem tem permissão de editar o card.
- O nome do responsável aparece ao lado da etapa; sem responsável mostra "atribuir".

## 3. Prazo por setor

- Nova coluna `prazo` em `op_ordem_setores`.
- Campo de data por setor, disponível em: diálogo de nova ordem, diálogo de implementar projeto e dentro do card (edição para quem pode editar).
- Validação: o prazo do setor não pode ser maior que a data final do evento/prazo da ordem. O input recebe `max` com essa data e a gravação bloqueia valores acima, com mensagem clara.
- No card e no Gantt, o prazo do setor atual é exibido e destacado quando estiver vencido.

## 4. Implementar projeto: escolher setores

- Depois de escolher o evento, abre um segundo passo com a lista de setores: Preparação e Executivo permanecem fixos e marcados; os demais são selecionáveis com a sequência exibida.
- Nesse mesmo passo é possível informar o prazo de cada setor selecionado (limitado pela data final do evento).
- Só os setores marcados entram no roteiro da ordem.

## 5. Card mais limpo (imagem 2)

O bloco com todas as etiquetas de setores ocupa muitas linhas no card.

- No card do quadro: mostrar apenas uma trilha compacta — setor atual em destaque, contagem "3/10", e pontinhos por setor (verde concluído, cheio atual, vazio pendente), tudo em uma linha.
- A lista completa de setores com nomes continua dentro do diálogo do card, onde há espaço.
- Ajustar também a barra de progresso e o texto "sem checklist" para não competirem visualmente.

## 6. Estoque — Dashboard

- **Cores dos gráficos:** os gráficos estão saindo pretos/apagados porque as cores usam um formato incompatível com os tokens atuais. Trocar por tokens de gráfico consistentes: entradas em verde e saídas em vermelho/laranja, legendas e eixos legíveis em tema claro e escuro.
- **Análise por evento/projeto:** nova seção com ranking de eventos/projetos por valor e quantidade de saídas no período; ao selecionar um evento, lista dos itens que saíram para ele (item, quantidade, valor).
- **Entradas por mês (volume):** gráfico de volume (quantidade de itens) de entradas por mês, separado do gráfico de valores.

## 7. Estoque — Relatório "Projeção de materiais"

- Novo tipo de relatório: o usuário escolhe os itens no campo de seleção já existente.
- Colunas: Item (código + nome), Unidade, Quantidade em estoque, Valor unitário, Valor total.
- Itens sem saldo aparecem com quantidade 0 e valor 0 — nenhum item selecionado é omitido.
- Total geral no rodapé; exportação CSV e PDF como nos demais relatórios.

## Detalhes técnicos

- Migração: `ALTER TABLE op_ordem_checklist ADD COLUMN responsavel_id uuid`, `ALTER TABLE op_ordem_setores ADD COLUMN prazo date`.
- Arquivos: `src/routes/operacao.index.tsx`, `src/components/operacao/ChecklistCardDialog.tsx`, `src/components/operacao/ImplementarProjetoDialog.tsx`, `src/components/operacao/GanttOrdens.tsx`, `src/lib/operacao.ts`, `src/routes/dashboard.tsx`, `src/routes/relatorios.tsx`.
- O relatório de projeção monta as linhas a partir da lista de itens selecionados (left join lógico), não a partir das movimentações, garantindo linhas zeradas.
