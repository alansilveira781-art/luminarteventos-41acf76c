# Bonificação: casar eventos do calendário com as vendas pelo nome

## O que muda

Hoje a lista de Bonificação usa os eventos realizados do calendário e só consegue puxar categoria e valor quando o evento está vinculado a uma venda. Quando não há vínculo, a linha fica sem categoria e com valor zero, o que atrapalha a sugestão de complexidade.

Passa a funcionar assim:

- Se o evento tem venda vinculada, continua usando essa venda (prioridade).
- Se não tem, o sistema procura na aba Vendas do Comercial um lançamento cujo nome do evento seja equivalente — ignorando maiúsculas/minúsculas, acentos, espaços duplicados e pontuação. Havendo correspondência única, a categoria e o valor final dessa venda são usados.
- Se o nome bater com mais de uma venda, é escolhida a venda com a data de evento mais próxima da data do evento do calendário.
- Se não bater com nada, a linha continua como hoje (sem categoria, valor zero, complexidade em branco para preenchimento manual).

Na tabela, o nome do evento passa a mostrar um indicador discreto de origem: "venda vinculada", "casado por nome" ou "sem venda", para ficar claro de onde veio a categoria/valor.

## Detalhes técnicos

- `src/lib/comercial/bonificacao.ts`, hook `useEventosRealizados`: além do lookup por `venda_id`, buscar em `comercial_vendas` (`id, nome_evento, categoria/tipo_evento, valor_final, data_evento`) e montar um índice por nome normalizado (NFD sem diacríticos, lowercase, colapso de espaços, remoção de pontuação) reaproveitando o `normalize` já existente no arquivo.
- Resolução por evento: `venda_id` → índice por nome (empate resolvido pela menor diferença entre `data_evento` da venda e `dataFim` do evento) → nulo.
- `EventoRealizado` ganha `categoria: string | null` (vinda da venda) e `origemVenda: "vinculada" | "nome" | null`; o componente passa a usar essa categoria em vez de apenas `tipo` do evento.
- `src/components/financeiro/DistribuicaoBonificacao.tsx`: usar a nova categoria na sugestão de complexidade e no multiplicador, e exibir o badge de origem ao lado do nome do evento.
- Sem mudanças de banco de dados.
