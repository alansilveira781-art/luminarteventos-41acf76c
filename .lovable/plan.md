# Operação: kanban de setores com checklist + Gantt

Hoje o quadro mostra um kanban por setor (colunas = etapas daquele setor). Vamos inverter: um único kanban onde as **colunas são os setores** (o passo a passo da produção) e cada card é uma ordem que caminha entre eles. Ao abrir o card, aparece o **checklist das etapas do setor atual**, que dá a noção de progresso até a finalização.

Não há ordens de produção cadastradas ainda, então a mudança de estrutura não afeta dados existentes.

## Como vai funcionar

**Roteiro do card**
- Ao criar a ordem, o usuário escolhe por quais setores ela passa (marcando na lista de setores ativos, já na ordem configurada).
- O kanban mostra todas as colunas de setores, mas o card só transita pelos setores do seu roteiro. Arrastar para um setor fora do roteiro é bloqueado com aviso.

**Checklist**
- Abrindo o card, aparece o checklist com as etapas do setor onde ele está.
- Cada item marcado registra quem marcou e quando.
- Um contador mostra "3/5 etapas" no card e no diálogo, além de uma barra de progresso geral do roteiro (setores concluídos + progresso do atual).

**Avanço manual**
- O botão "Avançar para <próximo setor>" fica disponível a qualquer momento (com confirmação quando ainda há itens não marcados).
- No último setor do roteiro, o botão vira "Concluir OP".
- Arrastar o card entre colunas também move, respeitando o roteiro e a permissão de mover.

**Visualização Gantt**
- Alternância "Quadro / Gantt" no topo da página de Operação.
- Uma linha por ordem, barra do início (data de criação ou início informado) até o prazo, colorida pelo setor atual, com marcadores de hoje e de atraso.
- Filtros por evento e por setor atual; ordens sem prazo aparecem em uma lista à parte.

## Detalhes técnicos

Banco (migração com GRANTs + RLS no padrão do módulo):
- `op_ordem_setores` — roteiro por ordem: `ordem_id`, `setor_id`, `posicao`, `status` (pendente/em_andamento/concluido), `iniciado_em`, `concluido_em`.
- `op_ordem_checklist` — itens gerados a partir de `op_setor_etapas` quando o card entra no setor: `ordem_id`, `setor_id`, `etapa_id`, `nome`, `concluido`, `concluido_por`, `concluido_em`.
- `op_ordens`: `setor_id` passa a significar "setor atual"; adiciona `data_inicio` (date, opcional) para a barra do Gantt. `etapa_atual_id` deixa de ser usado na navegação (mantido para histórico).
- Apontamentos (`op_ordem_apontamentos`) continuam sendo abertos/fechados na troca de setor, para medir tempo por setor.

Frontend:
- `src/routes/operacao.index.tsx`: colunas por setor, card com progresso e chips do roteiro, dnd-kit já em uso; toggle Quadro/Gantt.
- `src/components/operacao/ChecklistCardDialog.tsx`: novo diálogo com checklist, observações, avançar/concluir.
- `src/components/operacao/GanttOrdens.tsx`: timeline própria, no mesmo estilo do Gantt de Eventos.
- Nova ordem: seleção de setores do roteiro; ao criar, grava roteiro e gera o checklist do primeiro setor.
- Permissão de mover/marcar: admin, admin do módulo ou responsável do setor — leitura para os demais.
