# Operação: prazos gerados pelo tempo médio de cada setor

Hoje, ao criar uma ordem (Nova ordem ou Implementar projeto), o prazo de cada setor do roteiro é digitado um por um. Passa a bastar informar a **data de início**: os prazos de todos os setores do roteiro são calculados em cadeia usando o **tempo médio** configurado por setor.

## Como vai funcionar

**Configuração (aba Setores e etapas)**
- Cada setor ganha o campo "Tempo médio (dias)".
- Exemplo: Preparação = 5 dias, Executivo = 3 dias.

**Ao criar a ordem**
- O usuário informa a data de início (ex.: 12/08/2026).
- O sistema encadeia os prazos na ordem do roteiro:
  - Preparação: 12/08 + 5 dias = 17/08/2026
  - Executivo: 17/08 + 3 dias = 20/08/2026
  - e assim por diante.
- Cada prazo já vem preenchido no campo e **pode ser editado**. Ao editar um setor, os setores seguintes são recalculados a partir dele; o valor editado manualmente não é sobrescrito.
- Mudar a data de início ou marcar/desmarcar setores recalcula automaticamente os prazos que não foram editados à mão.
- Botão "Recalcular prazos" para voltar tudo ao cálculo automático.
- Continua valendo a validação atual: nenhum prazo pode ultrapassar a data final do evento (aviso ao salvar). Setor sem tempo médio configurado (0) herda a data do setor anterior.
- Dias contados em dias corridos (calendário).

**No card**
- Nada muda na edição de prazos por setor já existente no diálogo do card; ordens antigas seguem intactas.

## Detalhes técnicos

Banco (uma migração):
- `op_setores`: nova coluna `dias_medios integer not null default 0`.

Frontend:
- `src/lib/operacao.ts`: tipo `Setor` com `dias_medios`; função `calcularPrazosRoteiro(dataInicio, setoresDoRoteiro, manuais)` retornando o mapa `setor_id -> prazo` acumulado.
- `src/routes/operacao.setores.tsx`: input numérico "Tempo médio (dias)" por setor, salvo em `op_setores`.
- `src/routes/operacao.index.tsx` (NovaOrdemDialog): `prazosSetor` passa a ser derivado de `calcularPrazosRoteiro` via efeito sobre `dataInicio` + seleção, com registro de quais campos foram editados manualmente e botão de recalcular.
- `src/components/operacao/ImplementarProjetoDialog.tsx`: mesma lógica, com data de início editável (hoje por padrão) alimentando `op_ordens.data_inicio` e os prazos de `op_ordem_setores`.
