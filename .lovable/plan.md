# Ajuste de layout nos campos de montagem/desmontagem

## Contexto
Na tela `/solicitar-contrato`, a seção de horários opcionais de montagem/desmontagem está renderizada com `sm:grid-cols-4`, deixando os quatro campos de time apertados em uma única linha. A label "Desmontagem — término" quebra/feia e o campo fica sem respiro (conforme screenshot enviado).

## O que será feito
1. Reorganizar os 4 campos de horário em duas linhas de 2 colunas:
   - Primeira linha: Montagem — início / Montagem — término
   - Segunda linha: Desmontagem — início / Desmontagem — término
2. Aumentar o espaçamento interno (`gap`) e o respiro vertical da seção para evitar que os campos fiquem grudados.
3. Reduzir levemente o tamanho das labels dos horários (ex.: `text-xs`) para dar mais ar no campo, sem perder legibilidade.
4. Manter o comportamento existente: horários continuam opcionais, só aparecem quando o checkbox "Informar horários" está marcado.

## Arquivo envolvido
- `src/routes/solicitar-contrato.tsx` (seção de período de montagem/desmontagem, linhas ~579-598)

## Escopo
Apenas ajuste de apresentação/CSS no formulário público. Nenhuma mudança de schema, validação ou payload.
