# Período do evento no contrato + barra de campos fixa

## 1. Período do evento/projeto no formulário

Hoje o formulário público de solicitação de contrato pede apenas os períodos de montagem e desmontagem. Falta o período do próprio evento.

O que muda em `/solicitar-contrato` (vale para Pessoa Física e Jurídica, é o mesmo bloco):

- Nova seção "Período do evento", antes dos períodos de montagem/desmontagem, com:
  - Início do evento (data, obrigatório)
  - Término do evento (data, obrigatório)
  - Horários de início e término do evento (opcionais, no mesmo checkbox de horários já existente)
- Validações: término não pode ser anterior ao início; a montagem não pode começar depois do início do evento; a desmontagem não pode começar antes do término do evento.

No card do Jurídico, o período do evento aparece junto dos demais períodos e pode ser editado da mesma forma.

## 2. Campos automáticos nos modelos

Novos botões na lista de campos automáticos do editor de modelos:

- Período do evento (texto pronto, ex.: "de 10 a 12 de setembro de 2026, das 10h às 20h")
- Início do evento
- Fim do evento

## 3. Barra de campos automáticos fixa

No editor de modelo, a faixa "Campos automáticos" passa a ficar grudada no topo da área de edição ao rolar o conteúdo, para poder clicar nos campos a qualquer altura do contrato. A faixa ganha rolagem própria com altura máxima, para não ocupar meia tela quando houver muitos campos.

## Detalhes técnicos

- Migração: adicionar em `juridico_contratos` as colunas `evento_inicio` (date), `evento_fim` (date), `evento_hora_inicio` (time), `evento_hora_fim` (time).
- `src/routes/solicitar-contrato.tsx`: novos campos no estado inicial, validação e payload, seguindo o padrão dos campos de montagem.
- `src/routes/api/public/solicitar-contrato.ts`: validação Zod e persistência dos 4 campos novos.
- `src/routes/juridico.index.tsx`: exibição/edição do período do evento no `CardDetalheDialog`.
- `src/lib/juridico/modelo-render.ts`: em `variaveisDoContrato`, `evento_periodo` via `periodoTexto`, mais `evento_inicio`/`evento_fim`; entradas correspondentes em `CAMPOS_SUGERIDOS`.
- `src/routes/juridico.modelos.tsx`: a div da barra de campos recebe `sticky top-0 z-10` com fundo sólido e `max-h-28 overflow-y-auto`, dentro do container rolável do diálogo.
