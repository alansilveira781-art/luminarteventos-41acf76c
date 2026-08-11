# Valor total por extenso nos modelos de contrato

Nova variável automática que escreve o valor total do contrato em palavras.

## O que muda

- Nova variável `[valor_extenso]` (com apelido `[valor_total_extenso]`), disponível na barra de campos automáticos do editor de modelos, com o rótulo "Valor total por extenso".
- Formato: "trinta mil reais", "cento e vinte e nove mil e trezentos reais", "mil duzentos e cinquenta reais e cinquenta centavos".
- Se o contrato não tiver valor preenchido, o campo continua destacado como pendente, igual às demais variáveis.

## Detalhes técnicos

- Criar `src/lib/juridico/valor-extenso.ts` com uma função pura `valorPorExtenso(n: number)` em português do Brasil: unidades/dezenas/centenas, escalas mil/milhão/bilhão, conjunção "e" conforme a norma, singular/plural de real/reais e centavo/centavos.
- Em `src/lib/juridico/modelo-render.ts`: adicionar `valor_extenso` e `valor_total_extenso` ao mapa de `variaveisDoContrato` (derivados de `c.valor`), e incluir a entrada em `CAMPOS_SUGERIDOS` logo após "Valor total".
- Sem alterações de banco de dados.
