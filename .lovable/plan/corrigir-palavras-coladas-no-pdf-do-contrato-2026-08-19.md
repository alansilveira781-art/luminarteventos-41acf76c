# Corrigir palavras coladas no PDF do contrato

## Causa confirmada

Na geração do PDF, cada parágrafo é lido com `textContent`. Isso descarta as quebras `<br>`, e os dois trechos ficam colados sem espaço — por isso aparece "…de Freitasinscrito no CNPJ…".

O problema atinge todo texto que usa `<br>`, e não só esse caso:

- modelos importados do Word (o modelo "Stand" já tem `<br>` no corpo);
- a lista de parcelas e a forma de pagamento (uma parcela por linha, unidas por `<br>`);
- o bloco de assinaturas (linha de assinatura, nome e representante legal separados por `<br>`).

Em todos eles o PDF junta as linhas sem espaço.

## Correção

1. No conversor de HTML para blocos do PDF, tratar `<br>` como quebra de linha real: cada trecho separado por `<br>` vira uma linha própria do bloco, em vez de ser concatenado.
2. Garantir separação também entre elementos inline vizinhos (ex.: `</strong>` seguido de texto sem espaço) inserindo espaço quando o HTML não tiver nenhum, evitando novos casos de palavras coladas.
3. Fazer a mesma leitura no bloco de assinaturas, para que nome e representante legal continuem em linhas distintas no PDF.
4. Revisão dos demais pontos de junção de texto (limpeza de campos vazios e normalização de pontuação) para confirmar que não removem o espaço entre palavras quando um campo opcional some.

## Detalhes técnicos

- `src/lib/juridico/contrato-pdf.ts`: em `htmlParaBlocos`, substituir a leitura direta por uma extração que converte `<br>` em `\n` e divide o parágrafo em linhas; manter a detecção de cabeçalho de cláusula aplicada à primeira linha do bloco.
- Sem mudança em modelos salvos, banco ou fluxo do Clicksign; a prévia em tela já respeita `<br>` normalmente.
