# Cabeçalhos de cláusula em negrito e espaçamento do contrato

Ajustar a geração do PDF do contrato (o mesmo arquivo enviado ao Clicksign e usado na prévia) para que os títulos de cláusula saiam em negrito e o espaçamento entre blocos fique regular.

## O que muda

1. **Negrito nos cabeçalhos de cláusula**
   - Hoje só `<h1>/<h2>/<h3>` viram negrito no PDF. Textos como "CLÁUSULA PRIMEIRA — DO OBJETO" colados como parágrafo comum saem em texto normal.
   - Passa a reconhecer como cabeçalho, além dos `<h*>`: parágrafos curtos que começam com "CLÁUSULA", "PARÁGRAFO", "ANEXO", numeração tipo "1." / "1.1" seguida de título, ou parágrafos inteiramente em caixa alta.
   - Parágrafos que já vêm com `<strong>` no início (padrão de vários modelos) também são tratados como cabeçalho de cláusula.

2. **Espaçamento consistente**
   - Altura de linha, espaço antes/depois de cabeçalho, entre parágrafos e entre itens de lista passam a usar constantes únicas, em vez dos valores soltos atuais.
   - Cabeçalho ganha respiro maior acima do que abaixo (padrão de contrato), e o cabeçalho nunca fica sozinho no fim da página (quebra junto com a primeira linha do parágrafo seguinte).
   - Colapso de linhas em branco duplicadas herdadas do editor, para não gerar buracos irregulares.

3. **Prévia igual ao PDF**
   - A mesma classificação de cabeçalho é aplicada na prévia em tela do contrato, para o que o usuário vê no sistema bater com o PDF gerado.

## Detalhes técnicos

- `src/lib/juridico/contrato-pdf.ts`: em `htmlParaBlocos`, classificar blocos como `titulo` pelas regras acima; extrair constantes de espaçamento (`ALTURA_LINHA`, `ESPACO_ANTES_TITULO`, `ESPACO_DEPOIS_TITULO`, `ESPACO_PARAGRAFO`) e aplicar no laço de escrita; ajustar `quebra()` para considerar cabeçalho + primeira linha.
- `src/lib/juridico/modelo-render.ts`: um estilo de parágrafo/heading consistente na saída sanitizada, para a prévia acompanhar.
- Sem mudança de banco, de modelos salvos ou do fluxo de envio ao Clicksign.
