# Corrigir o modelo de contrato: negrito perdido ao salvar e formatação do PDF

Duas causas foram confirmadas ao inspecionar o editor e o modelo salvo no banco.

## O que está acontecendo hoje

1. **O negrito some ao salvar.** O botão de negrito do editor gera as marcações `<b>`/`<i>`, e a limpeza de segurança aplicada no salvamento só aceita `<strong>`/`<em>` — então tudo que foi marcado em negrito ou itálico é descartado antes de ir para o banco. O texto continua lá, só a formatação se perde.
2. **O texto colado do Word entra "sujo".** O modelo salvo (Stand) veio do Word com classes e estilos próprios do Word e com quebras de linha no meio dos parágrafos. Essas quebras é que produzem as linhas cortadas no PDF, e o negrito original do Word (também em `<b>`) já foi removido no salvamento.

## O que vai ser ajustado

1. **Negrito e itálico passam a ser salvos**
   - O editor grava negrito/itálico em marcação padrão, e a limpeza de segurança passa a aceitá-la (incluindo sublinhado e o negrito vindo por estilo, como o do Word).
   - O conteúdo salvo é lido diretamente do editor no momento de clicar em Salvar, e não só do que foi digitado — hoje há um caminho em que a última edição pode não ser capturada.
   - Ao reabrir o modelo, o conteúdo carregado é sempre o que está no banco.

2. **Colagem do Word limpa**
   - Ao colar, o conteúdo é normalizado: classes/estilos do Word removidos, quebras de linha soltas dentro do parágrafo viram espaço (fim das "palavras/linhas cortadas"), parágrafos vazios duplicados colapsados, mas **preservando** negrito, itálico, listas e a estrutura de parágrafos.

3. **Formatação do PDF alinhada ao modelo Word**
   - O negrito real do HTML (não só o detectado por padrão de texto) é respeitado trecho a trecho na geração do PDF e na prévia.
   - Espaçamento revisado: entrelinha 1,15; ~6 pt entre parágrafos; ~12 pt antes e ~6 pt depois dos títulos de seção; recuo de listas `a)`, `I.` e `<li>`.
   - Justificação aplicada a todo o corpo, com a última linha de cada parágrafo à esquerda, e títulos nunca sozinhos no fim da página.

4. **Prévia idêntica ao PDF** — mesmas regras de negrito, espaçamento e recuo na tela.

## Detalhes técnicos

- `src/lib/juridico/modelo-render.ts`: incluir `b`, `i`, `s`, `sup`, `sub` em `ALLOWED_TAGS`; adicionar `normalizarHtmlEditor()` que converte `<b>/<i>` e `style="font-weight:bold"` em `<strong>/<em>`, remove `class="Mso*"` e propriedades `mso-*`, remove `<span>` sem estilo útil e colapsa `\n` internos em espaço; aplicar antes de `sanitizeHtml` no salvamento.
- `src/routes/juridico.modelos.tsx`: `document.execCommand("styleWithCSS", false, "false")` antes dos comandos; trocar o `useMemo` de inicialização por `useEffect` com sincronização direta do `innerHTML`; no Salvar, ler `ref.current.innerHTML`; handler `onPaste` chamando `normalizarHtmlEditor` sobre `text/html` (fallback `text/plain`).
- `src/lib/juridico/contrato-pdf.ts`: `htmlParaBlocos` passa a emitir trechos (`{ texto, negrito }`) por bloco, em vez de texto plano, e `escreverLinha` alterna a fonte por trecho; revisar as constantes de espaçamento e o recuo de lista.
- Sem mudança de banco, de modelos já salvos ou do envio ao Clicksign.
