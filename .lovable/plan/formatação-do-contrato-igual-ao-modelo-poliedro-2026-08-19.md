# Formatação do contrato igual ao modelo Poliedro

Ajustar a geração do PDF (e a prévia em tela) para reproduzir a formatação do arquivo enviado, mantendo o papel timbrado atual.

## Padrão extraído do arquivo enviado

- Página A4, texto **justificado** em todos os parágrafos.
- Fonte Calibri 11 pt; no PDF será usada a fonte equivalente disponível no gerador, com o mesmo tamanho visual.
- Títulos de seção numerados em negrito: "1. DAS PARTES", "2. DO OBJETO", "4. DO PREÇO E FORMA DE PAGAMENTO"…
- Cláusulas ("Cláusula 1ª.", "Cláusula 4ª-A.", "Parágrafo Único:") são parágrafos normais justificados, com o rótulo inicial em negrito — não são títulos de seção.
- Itens de lista "a) b) c)" e "I. II. III." com recuo à esquerda e mesma altura de linha do corpo.
- Espaçamento: ~6 pt entre parágrafos, ~12 pt antes/depois dos títulos de seção, entrelinha simples (1,15).
- Título do instrumento no topo, em negrito e justificado.

## O que muda

1. **Justificação real** — hoje o texto sai alinhado à esquerda em algumas linhas; passa a ser justificado em todo o corpo, com a última linha de cada parágrafo alinhada à esquerda.
2. **Classificação de blocos** — três tipos em vez de dois:
   - título de seção (numerado ou caixa alta) → negrito, tamanho maior, espaço antes/depois;
   - abertura de cláusula ("Cláusula Xª.", "Parágrafo Único:") → corpo justificado com o rótulo em negrito na mesma linha;
   - parágrafo comum.
   Hoje "Cláusula 1ª." é tratada como título e sai toda em negrito, diferente do arquivo.
3. **Listas com recuo** — itens `a)`, `I.` e `<li>` ganham recuo à esquerda e alinhamento em bloco (segunda linha alinhada com a primeira), em vez do bullet "•" atual.
4. **Constantes de espaçamento** revistas para os valores acima (entrelinha, espaço entre parágrafos, antes/depois de título, espaço extra de lista).
5. **Prévia em tela** com as mesmas regras (justificado, recuo de lista, negrito só no rótulo da cláusula), para bater com o PDF.
6. Timbrado, cabeçalho, rodapé e o fluxo de envio ao Clicksign permanecem como estão.

## Detalhes técnicos

- `src/lib/juridico/contrato-pdf.ts`: em `htmlParaBlocos`, retornar `tipo: "titulo" | "clausula" | "paragrafo" | "lista"` com `rotulo` opcional (parte em negrito) e `nivel` de recuo; no laço de escrita, justificar com `splitTextToSize` + distribuição de espaços na linha (jsPDF `align: "justify"` só funciona por linha completa), desenhar o rótulo em negrito e o restante em normal na mesma linha, aplicar recuo de lista e as novas constantes de espaçamento; manter o controle de título órfão no fim da página.
- `src/lib/juridico/modelo-render.ts`: separar `ehCabecalhoClausula` em `ehTituloSecao` (numeração "1." / caixa alta) e `ehAberturaClausula` ("Cláusula", "Parágrafo"); `realcarCabecalhos` passa a negritar apenas o rótulo nas aberturas de cláusula e o parágrafo inteiro nos títulos de seção.
- Estilos da prévia (`text-align: justify`, recuos de `ul/ol`) aplicados no container que renderiza o HTML do contrato.
- Sem mudança de banco, de modelos salvos ou do envio ao Clicksign.
