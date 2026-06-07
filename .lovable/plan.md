## Objetivo
Alinhar os prefixos cadastrados na estrutura do DRE ao plano de contas real, conforme a lista do usuário: RB, DR, AC, DM, DC, CV, CD, CI, DS, DA, DT, RF, DF, OE, OS, IV. A lógica de classificação por prefixo, soma por grupo, cascata de subtotais e sinais (receber +, pagar −) já está implementada.

## Mudanças

### Migration em `ca_dre_estrutura`
- Linha código `IN` (Investimentos): `prefixos` `{IN}` → `{IV}`.
- Linha código `OE` (Outras Entradas): `prefixos` `{OE,OR}` → `{OE}`.

### `src/lib/conta-azul/dre.ts` (fallback `DRE_STRUCTURE`)
- `OE`: `prefixes: ["OE","OR"]` → `["OE"]`.
- `IN`: `prefixes: ["IN"]` → `["IV"]` (id interno continua `"IN"`, só o prefixo do plano de contas muda).

## Sem mudanças
- Extração de prefixo (`grupoDoPlanoNome`) e índice de prefixos (`buildPrefixIndex`).
- Cálculo em cascata dos subtotais (= ) via `formula` de cada linha.
- Sinal: contas a receber positivo, contas a pagar negativo.
- Cards do topo (Receita Bruta, Despesas, Custos, Lucro) — já leem `totais` agrupados.
- Filtro de transferências bancárias e lançamentos sem prefixo reconhecido (ignorados).

## Efeito esperado
Contas `IV - …` passam a somar em Investimentos; contas `OR - …` deixam de cair em Outras Entradas. Demais grupos seguem iguais.
