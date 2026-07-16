## Problema

Na Análise Detalhada (Financeiro › Conta Azul), depois da última alteração as saídas de estoque do evento "sumiram" da visualização.

Motivo: no ajuste anterior, ao invés de aparecerem como linhas próprias, elas passaram a ser mescladas dentro das rubricas do Conta Azul cuja `nome` do plano de contas casa exatamente (case/acentos ignorados) com `itens.categoria`. Quando não há esse casamento — que é o caso da maior parte das categorias de itens — os valores só aparecem em "(?) Sem classificação" e ficam pouco identificáveis. E mesmo quando há casamento, o valor da saída fica somado ao valor do Conta Azul na mesma linha, sem indicação de que veio do estoque.

## Solução

Trazer de volta uma identificação clara do "Estoque" no Demonstrativo, mantendo o drill-down que passa a listar as movimentações no painel de Lançamentos.

1. **Linhas próprias no Demonstrativo (coluna da esquerda).** Cada categoria de item vira uma linha de detalhe própria, com o rótulo `<Categoria> (estoque)`, agrupada em um novo bloco **"Estoque — Saídas do evento"** (kind `sum`, sign `-1`) inserido logo antes da linha de Lucro. Assim as saídas de estoque:
   - ficam sempre visíveis, independentemente do nome do plano de contas;
   - não somem/embaralham valores dentro de rubricas do Conta Azul;
   - continuam entrando no cálculo do lucro (sign `-1`), mantendo a coerência do DRE.

2. **Drill-down mantido.** Ao clicar em qualquer linha `<Categoria> (estoque)`, o painel de Lançamentos passa a listar as movimentações daquela categoria no evento selecionado, exatamente no formato já implementado (`[Estoque] Item × Qtd — (Categoria) — Observação`, com data, responsável e valor negativo).

3. **Fallback "Sem categoria".** Itens sem `categoria` preenchida entram como uma única linha `Sem categoria (estoque)` no mesmo bloco.

## Detalhes técnicos

Arquivo único: `src/components/financeiro/ContaAzulDashboard.tsx`.

- `stockAgg`: passar a agregar sempre sob um grupo dedicado (`"ES"`) usando `key = stock:<catNome>` (nunca mais mesclar em `hit.external_id`). Preservar `catNames` para o rótulo.
- `estruturaEfetiva`: se `stockAgg.agg.has("ES")`, injetar `{ id: "ES", label: "Estoque — Saídas do evento", kind: "sum", sign: -1, prefixes: [] }` antes da linha `LU`; incluir `"ES"` na fórmula do lucro localmente (soma junto com `DS/DA/DT/CV/CD/CI`) para o total bater. Remover a linha `SC` sintética que hoje é criada só para o estoque.
- `lancamentos`: continuar empurrando as movimentações com `categoria_external_id = stock:<catNome>` (mesma chave usada nos detalhes) — o filtro por clique já funciona.
- `planoMapExt`: mantém o rótulo `<catNome>` para as chaves `stock:*`; ajustar `linhasDre` para sufixar `" (estoque)"` quando `catId` começa com `stock:`.
- KPI "Custos": incluir `totais.ES ?? 0` no cálculo (`custos = CV + CD + CI + ES`) para o card refletir as saídas de estoque.

Sem mudanças de schema, backend ou de outras telas.
