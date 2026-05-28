## Objetivo

Resolver dois pontos:
1. O conteúdo fica "preso" na tela, sem rolagem vertical natural — especialmente nos quadros Kanban do Comercial e Compras.
2. Permitir que o sistema seja instalado no celular (iOS e Android) como um app.

## Parte 1 — Rolagem do sistema

Hoje a área principal usa `min-h-dvh` e cada Kanban usa alturas fixas (`max-h-[calc(100vh-140px)]`) com rolagem interna própria. Isso cria "rolagens dentro de rolagens" e prende o conteúdo.

Ajustes:
- Em `src/routes/__root.tsx`, transformar a área principal (`<main>`) em uma coluna com rolagem vertical própria e altura de tela (`h-dvh` + `overflow-y-auto`), mantendo a barra lateral fixa. Assim a página inteira rola de forma natural.
- Em `src/routes/comercial.index.tsx` e `src/routes/compras.index.tsx`, remover/relaxar as alturas fixas dos quadros Kanban (`max-h-[calc(100vh-...)]`) para que:
  - a rolagem **horizontal** entre colunas continue funcionando;
  - a rolagem **vertical** acompanhe a página principal, sem prender o usuário em um painel interno.
- Garantir que apareça uma barra de rolagem vertical visível quando o conteúdo passar da altura da tela.

## Parte 2 — App instalável no celular (iOS/Android)

A forma recomendada para "baixar no celular" sem complexidade é tornar o sistema **instalável** (Adicionar à Tela de Início) via Web App Manifest — funciona em Android (Chrome) e iOS (Safari), abrindo em tela cheia como um app.

Ajustes:
- Criar `public/manifest.json` com nome ("Grupo Luminart"), `display: standalone`, cores de tema e ícones.
- Gerar ícones do app (192px e 512px) com a identidade Luminart e salvá-los em `public/`.
- Referenciar o manifest e ícones no `head()` de `src/routes/__root.tsx` (link do manifest, apple-touch-icon, theme-color).

Observação importante: **não** será adicionado service worker / modo offline. Isso evita problemas conhecidos com o preview do editor. O recurso de instalação ("Adicionar à Tela de Início") só aparece no app publicado, não dentro do preview do editor.

### Detalhes técnicos
- Manifest mínimo (sem service worker), seguindo a abordagem "manifest-only" para instalabilidade.
- Ícones gerados via gerador de imagem e externalizados em `public/` (não como import ES6, pois manifest aponta por URL).
- Nenhuma alteração de backend ou lógica de negócio.

## Fora de escopo
- Suporte offline real / cache de dados.
- Publicação nas lojas App Store / Google Play (isso exigiria empacotamento nativo, que pode ser uma etapa futura).