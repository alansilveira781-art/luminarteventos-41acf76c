# Períodos de montagem e desmontagem no contrato

Hoje a tabela de contratos guarda apenas a data de fechamento — não existe nenhum campo de montagem/desmontagem. Vamos incluir esses períodos no formulário público (Pessoa Física e Jurídica, para os dois é o mesmo bloco), salvar no card do Jurídico e disponibilizar como campos automáticos nos modelos de contrato.

## O que muda

**1. Novo bloco "Período de montagem e desmontagem" no /solicitar-contrato**

Aparece no cartão de dados do contrato, igual para PF e PJ:

- Montagem: data de início * e data de término *
- Desmontagem: data de início * e data de término *
- Checkbox "Informar horários (opcional)" — ao marcar, mostra hora de início e fim da montagem e hora de início e fim da desmontagem

Validação: término não pode ser anterior ao início; desmontagem não pode começar antes do início da montagem. Se os horários não forem preenchidos, o contrato usa apenas as datas.

**2. Card do Jurídico**

O detalhe do contrato mostra o período de montagem/desmontagem e permite editar essas datas e horários, como já acontece com endereço e pagamento.

**3. Modelos de contrato**

Novos campos automáticos disponíveis na barra "Campos automáticos":

- Início da montagem, Fim da montagem, Período de montagem (texto pronto, ex.: "10/09/2026 a 12/09/2026, das 08h00 às 18h00")
- Início da desmontagem, Fim da desmontagem, Período de desmontagem
- Quando não houver horário informado, o texto sai só com as datas.

## Detalhes técnicos

- Migração em `juridico_contratos`: `montagem_inicio` / `montagem_fim` / `desmontagem_inicio` / `desmontagem_fim` (date) e `montagem_hora_inicio` / `montagem_hora_fim` / `desmontagem_hora_inicio` / `desmontagem_hora_fim` (time), todos nuláveis.
- `src/routes/solicitar-contrato.tsx`: novos campos no estado `vazio`, bloco de UI com checkbox de horários e validação no submit.
- `src/routes/api/public/solicitar-contrato.ts`: schema Zod com datas `YYYY-MM-DD` obrigatórias, horários `HH:MM` opcionais, checagem de ordem das datas e persistência das colunas.
- `src/routes/juridico.index.tsx`: exibição no `ContratoDetalhesDialog` + edição inline dos campos.
- `src/lib/juridico/modelo-render.ts`: novas chaves em `variaveisDoContrato` (`montagem_inicio`, `montagem_fim`, `montagem_periodo`, `desmontagem_inicio`, `desmontagem_fim`, `desmontagem_periodo`) e entradas em `CAMPOS_SUGERIDOS`.
