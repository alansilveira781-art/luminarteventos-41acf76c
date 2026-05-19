## Objetivo

Reescrever `src/lib/comercial/pdf.ts` para que a impressão da proposta siga o layout do exemplo anexado (Luminart): A4 **paisagem**, capa centralizada com logo, páginas de ambiente com cabeçalho preto e total no rodapé, e página final "Investimento" com tabela resumida.

Mudança puramente de apresentação — não toca em tipos, store, wizard ou drawer.

## Pré-requisito

Você vai me enviar o logo (`PNG` ou `SVG`). Vou salvá-lo em `src/assets/luminart-logo.png` e importá-lo como módulo, convertendo para data URL em runtime para o `jsPDF`. Se vier SVG, rasterizo via `<canvas>` antes de embutir.

## Layout

### Página 1 — Capa (tudo centralizado)
```text
              [ LOGO Luminart ]
        ─────── linha dourada ───────
            Seu Sonho, Nosso Projeto
              ── ORC-{numero} ──

              Cliente:            {nome}
              Local do Evento:    {local}
              Período:            {periodo}
              Data do Orçamento:  {data}
              Consultor(a):       {responsavel}

        [ ondas decorativas no rodapé ]
```
- Bloco de campos: labels alinhados à direita + valores em negrito alinhados à esquerda, agrupados num grid centrado horizontalmente na página.
- Ondas decorativas desenhadas em vetor (jsPDF paths) com tons `#E8A33D` (laranja) e `#B5B5B5` (cinza).

### Páginas 2..N — Um ambiente por página
```text
█ {NOME DO AMBIENTE EM CAIXA ALTA} ████████████████████████

       Imagem                  Descrição/Componentes
   ┌─────────────┐         ITEM EM NEGRITO
   │             │         - descrição em itálico (medidas)
   │  [foto]     │         - descrição em itálico
   └─────────────┘         OUTRO ITEM
                           - descrição em itálico
                           ...

████ Total ambiente:  R$ {subtotal} ███████████████████████
```
- Barra preta de cabeçalho (altura ~14mm) com o nome do ambiente em branco, à esquerda.
- Coluna imagem ~40% / coluna descrições ~60%, com cabeçalhos cinza-claro "Imagem" e "Descrição/Componentes".
- Item em **negrito CAIXA ALTA**, descrições em *itálico*. Mantém a formatação por `tipoMedida` (unidade, dimensional, área, linear) que já existe.
- Barra preta de rodapé com "Total ambiente: R$ …" centralizado em branco.
- Se as descrições estourarem a página, abre nova página com o mesmo cabeçalho e segue.

### Última página — Investimento
```text
          ─── INVESTIMENTO ───

              Ambiente A         R$ ...
              Ambiente B         R$ ...
              Frete              R$ ...
              Montagem           R$ ...
              ...

       ▓▓▓ Total Geral:  R$ ... ▓▓▓     ← faixa laranja

         Av. Maestro Lisboa, 2181 - Lagoa Redonda - Fortaleza CE
              (85) 9 9997-1804 / (85) 9 9933-1605
                  comercial@luminarteventos.com.br

        ── Detalhes que transformam eventos em experiências. ──
```
- Tabela centralizada (label / valor) com linhas finas separando.
- "Total Geral" numa faixa laranja com sombra suave (retângulo + retângulo cinza deslocado).
- Rodapé fixo com endereço, telefones e email + tagline em itálico entre duas linhas douradas.

## Paleta

```ts
const GOLD = [232, 163, 61];   // #E8A33D
const INK  = [20, 20, 20];     // preto suave
const GREY = [180, 180, 180];
const SOFT = [240, 240, 240];  // cabeçalho de tabela
```

## Detalhes técnicos

- `new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })` → 297×210mm.
- Logo: `import logoUrl from "@/assets/luminart-logo.png"` → `fetch` → `FileReader` → data URL no top-level da função (carrega uma vez).
- Ondas da capa: dois `doc.path()`/curvas Bezier (ou `lines` com `bezierCurveTo`) preenchidas com `setFillColor`.
- Barras pretas: `doc.setFillColor(...INK); doc.rect(0, y, 297, 14, "F");` com texto branco via `setTextColor(255,255,255)`.
- Faixa laranja do Total Geral: `rect` arredondado simulado com dois retângulos (sombra cinza atrás + faixa dourada na frente).
- Numeração de página continua no rodapé das páginas de ambiente apenas (capa e investimento sem número, como no exemplo).
- `descricaoLinha()` permanece igual (já formata por tipoMedida).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/comercial/pdf.ts` | Reescrita completa do layout (paisagem + novas seções) |
| `src/assets/luminart-logo.png` | **novo** — logo que você vai enviar |

Nenhuma alteração em tipos, store, wizard, drawer ou rotas.

## Próximo passo

Após aprovar o plano, me envie o arquivo do logo na próxima mensagem que eu implemento.
