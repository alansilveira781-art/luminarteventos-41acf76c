# Corrigir logo esticada no PDF da O.S.

A logo do arquivo é quadrada (1080x1080), mas no relatório da O.S. ela é desenhada em um retângulo de 34x12 mm, o que achata a marca. Os outros relatórios (proposta comercial, contrato) já calculam a largura/altura a partir das proporções reais da imagem.

## O que muda

- No gerador do PDF da O.S., a logo passa a ser inserida respeitando a proporção original: define-se uma altura fixa (cerca de 14 mm) e a largura é calculada a partir da razão da imagem, com limite máximo de largura para não invadir o título.
- Posicionamento no canto superior esquerdo mantido, com o título e o número da O.S. à direita e a linha âmbar abaixo — o layout continua igual, só a marca deixa de ficar espremida.

## Detalhes técnicos

- `src/lib/patrimonio/os-pdf.ts`: `carregarLogo()` passa a retornar também `width`/`height` naturais (via `Image`/`decode` ou `doc.getImageProperties`), e a chamada `doc.addImage` usa essas dimensões para calcular `w = h * (natW / natH)`, no mesmo padrão de `src/lib/comercial/pdf.ts` e `src/lib/juridico/contrato-pdf.ts`.
