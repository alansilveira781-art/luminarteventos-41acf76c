## O que será feito

Fixar a linha **Lucro** (`LU`) na base do card **Demonstrativo** nas duas abas do Dashboard Financeiro: **Painel Financeiro** e **Análise Detalhada**, para que ela permaneça visível mesmo quando o usuário rolar as demais linhas.

## Arquivo a alterar

- `src/components/financeiro/ContaAzulDashboard.tsx`

## Como está hoje

- O card **Demonstrativo** renderiza todas as linhas da DRE (`linhasDre`) dentro de uma única div scrollável com `max-h-[600px] overflow-y-auto`.
- A linha `LU` (Lucro) é a última da estrutura e some ao rolar para cima.
- O card vizinho **Lançamentos** já tem uma linha de total fixa na parte inferior, fora da rolagem.

## Alteração técnica

1. Separar a linha `LU` do array de linhas scrolláveis.
2. Renderizar o Lucro como um rodapé fixo na base do card **Demonstrativo**, abaixo da área de rolagem.
3. Manter as mesmas colunas (`[1fr,140px,70px]`), formatação de valor/percentual e destaque visual (negrito e fundo diferenciado).
4. Aplicar a mesma lógica nos dois locais: função `PainelFinanceiro` e função `AnaliseDetalhada`.

## Resultado esperado

- O Lucro fica sempre visível no final do Demonstrativo.
- A rolagem continua funcionando para as demais linhas (Receita Bruta, Deduções, Despesas, Custos, etc.).
- Altura e comportamento de scroll continuam alinhados ao card de Lançamentos.