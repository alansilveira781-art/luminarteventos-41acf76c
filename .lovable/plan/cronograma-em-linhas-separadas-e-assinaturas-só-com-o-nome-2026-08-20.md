# Cronograma em linhas separadas e assinaturas só com o nome

## O que está acontecendo

No modelo "Stand" salvo no banco, o cronograma está como lista:

```text
<span style="text-align:justify"><ul><li><strong>Montagem:</strong> [montagem_periodo];</li>
<li><strong>Evento:</strong> [evento_periodo];</li>
<li><strong>Desmontagem:</strong> [desmontagem_periodo].</li></ul></span>
```

A lista (`<ul>`) está envolvida por um `<span>` (marcação inválida vinda da colagem do Word). Na geração do PDF, esse `<span>` é tratado como texto inline, então os três itens são concatenados em um único parágrafo justificado — exatamente o que aparece na primeira imagem ("Montagem: …; Evento: …; Desmontagem: …" tudo corrido).

## Ajustes

1. **Desembrulhar wrappers inline que contêm blocos** — ao salvar o modelo e ao gerar o PDF/prévia, um `<span>`/`<font>` que contenha `<ul>`, `<ol>`, `<p>`, `<div>` ou `<li>` é removido, mantendo o conteúdo. Assim cada item da lista volta a ser um bloco próprio.
2. **Item de lista = uma linha recuada, sem bullet** — cada `<li>` do cronograma vira uma linha própria, com recuo à esquerda igual ao do modelo, rótulo em negrito ("Montagem:", "Evento:", "Desmontagem:") e o restante em texto normal, sem justificar (segunda imagem).
3. **Assinaturas sem CPF** — no bloco de assinaturas passa a constar apenas o nome (razão social/cliente na linha e o nome do representante ou da testemunha abaixo). Nenhum documento é impresso.
4. A prévia em tela segue a mesma regra, para bater com o PDF.

## Detalhes técnicos

- `src/lib/juridico/modelo-render.ts`
  - `normalizarHtmlEditor`: desembrulhar `span`/`font`/`b`/`i` que contenham elementos de bloco antes da sanitização.
  - `blocoAssinaturas`: remover `fmtDoc(...)` das linhas de contratada, cliente, 2º representante e testemunhas — manter só os nomes.
- `src/lib/juridico/contrato-pdf.ts`
  - `walk`: tratar `span`/`font` com filhos de bloco como container (descer nos filhos) em vez de acumular como parágrafo inline.
  - Confirmar que blocos `tipo: "lista"` usam `RECUO_LISTA`, rótulo em negrito e não são justificados.
- Sem mudança de banco: os modelos já salvos continuam válidos e passam a renderizar corretamente.
