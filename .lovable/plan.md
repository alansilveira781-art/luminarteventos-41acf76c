# Corrigir erro ao abrir anexos PDF

## Diagnóstico

O erro `Failed to fetch dynamically imported module: .../PdfPreview-DCz-NIjR.js` acontece porque o `PdfPreview.tsx` é carregado via `lazy(() => import(...))` em `src/components/AnexoViewer.tsx`. Depois de um novo deploy, o nome do chunk muda (hash novo) e abas antigas que ainda estão abertas tentam buscar o chunk antigo, que já não existe no CDN — então o `import()` falha e o ErrorBoundary mostra "Something went wrong".

Não é um bug do PDF em si: é um problema clássico de chunk obsoleto pós-deploy. Afeta qualquer anexo aberto pelo `AnexoViewer` (não só na aba Rotinas Financeiras), mas só dispara quando o tipo é PDF, porque é o único caminho que faz lazy-load.

## Solução

Tornar o lazy-load resiliente: se o `import()` falhar (chunk não encontrado após deploy), recarregar a página automaticamente uma única vez para puxar o bundle atualizado.

### Mudança em `src/components/AnexoViewer.tsx`

Trocar:

```ts
const PdfPreview = lazy(() => import("./PdfPreview"));
```

por um wrapper que tenta novamente e, se persistir o erro de fetch de módulo, força um reload controlado (com flag em `sessionStorage` para evitar loop infinito):

```ts
const PdfPreview = lazy(() =>
  import("./PdfPreview").catch((err) => {
    const msg = String(err?.message ?? err);
    const isChunkError =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed");
    if (isChunkError && !sessionStorage.getItem("pdfpreview-reloaded")) {
      sessionStorage.setItem("pdfpreview-reloaded", "1");
      window.location.reload();
    }
    throw err;
  })
);
```

A flag é limpa naturalmente quando a aba é fechada (sessionStorage). Se o reload resolver, o usuário nem percebe; se não resolver (erro real), o ErrorBoundary continua aparecendo sem entrar em loop.

## Fora do escopo

- Não mexer no `PdfPreview.tsx` em si.
- Não mexer na lógica de Rotinas Financeiras / despesas — o erro é global do viewer de anexos.
- Não mudar config do Vite/chunking.
