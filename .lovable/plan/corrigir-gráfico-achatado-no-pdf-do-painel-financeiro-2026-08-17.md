# Corrigir gráfico achatado no PDF do Painel Financeiro

No relatório exportado, o gráfico de Custos Variáveis aparece espremido (barras e textos comprimidos na vertical), porque a imagem é encaixada numa altura máxima fixa sem respeitar a proporção original.

## O que muda

- A imagem do gráfico passa a manter a proporção real: quando a altura necessária ultrapassa o espaço disponível, a largura é reduzida junto (a imagem fica menor, nunca deformada).
- O gráfico de CV, que cresce conforme o número de categorias, ganha espaço próprio: se não couber no restante da página, começa em página nova, com altura útil de até quase uma página inteira.
- A captura do gráfico é feita em resolução maior, para os nomes das categorias e os valores ficarem nítidos no papel.
- O gráfico de pizza continua ao lado da legenda, também com proporção preservada.

## Detalhes técnicos

- `src/lib/conta-azul/painel-pdf.ts`: no laço de `input.graficos`, calcular `escala = min(1, alturaMax / (imagem.h/imagem.w * imgW))` e aplicar em largura e altura ao chamar `addImage`, em vez de apenas travar `imgH` no máximo. Definir `alturaMax` por gráfico (pizza ~70mm, barras até `ph - 2*M - espaço do título/texto`) e chamar `quebra()` antes de desenhar quando a imagem grande não couber.
- `src/components/financeiro/ContaAzulDashboard.tsx`: nenhuma mudança de layout na tela; apenas passar uma escala maior (3x) em `svgParaPng` para a captura do gráfico de CV, se necessário.
- Sem alterações em cálculos, consultas ou dados.
