# Quadro de Produção: Preparação/Executivo, descrições nas etapas e Implementar projeto

## 1. Dois setores fixos no início

Hoje o quadro começa em Costura. Serão criados os setores **Preparação** (posição 1) e **Executivo** (posição 2), sempre à frente de Costura, Usinagem, Metalurgia, Estrutura, Comunicação Visual, Marcenaria, Almoxarifado, Iluminação e Pintura.

- Ficam marcados como setores fixos: não podem ser excluídos nem reordenados para depois dos demais na tela de Setores e etapas.
- Toda ordem nova já nasce com Preparação e Executivo no roteiro (marcados e travados na criação), seguidos dos setores que o usuário escolher.

## 2. Descrição nas etapas

- Na tela **Setores e etapas**, cada etapa ganha um campo de descrição ("o que deve ser feito"), em área de texto abaixo do nome.
- No checklist do card, a descrição aparece como texto de apoio abaixo do nome do item (recuado, menor), para quem executa saber o que fazer.
- Etapas já existentes ficam sem descrição até serem preenchidas — nada quebra.

## 3. Botão "Implementar projeto"

Novo botão ao lado de "Nova ordem", no topo do Quadro de Produção. Ele abre um diálogo com os eventos do calendário:

- **Agrupamento por semana (padrão)**: os eventos aparecem em blocos "Semana de 10/08 a 16/08", ordenados pela data do evento.
- **Filtro por mês** no topo do diálogo (mês atual por default), com alternância "Semana / Mês" para ver a lista corrida do mês inteiro.
- Cada linha mostra código, nome, local/cidade e as datas de montagem/evento; busca por texto disponível.
- Ao clicar em um evento, é criada **uma ordem** referente a ele, já posicionada na coluna **Preparação**, com o roteiro Preparação → Executivo → demais setores ativos, checklist do primeiro setor gerado e o evento vinculado no card.
- Evento que já tem ordem criada aparece sinalizado, para evitar duplicidade.

## Detalhes técnicos

Banco (uma migração):
- Inserir `op_setores` Preparação (ordem 1) e Executivo (ordem 2) com coluna nova `fixo boolean default false` marcada como `true`.
- `op_setor_etapas`: nova coluna `descricao text`.
- `op_ordem_checklist`: nova coluna `descricao text`, copiada da etapa quando o checklist é gerado.
- `op_ordens`: nova coluna `evento_id uuid` referenciando `eventos(id)` para ligar a ordem ao evento do calendário.

Frontend:
- `src/routes/operacao.setores.tsx`: campo de descrição por etapa (salvo com debounce), bloqueio de exclusão/reordenação dos setores fixos.
- `src/components/operacao/ChecklistCardDialog.tsx`: exibir descrição sob cada item; `garantirChecklist` passa a copiar a descrição da etapa.
- `src/components/operacao/ImplementarProjetoDialog.tsx` (novo): lista de eventos com agrupamento semanal/mensal, filtro de mês, busca e criação da ordem (insert em `op_ordens` + `op_ordem_setores` + `garantirChecklist`).
- `src/routes/operacao.index.tsx`: botão "Implementar projeto"; em `NovaOrdemDialog`, Preparação e Executivo pré-selecionados e travados no roteiro.
