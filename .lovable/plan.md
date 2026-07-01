## Objetivo
Padronizar o compartilhamento por link em Compras, Despesas e Rotinas Financeiras, adicionando um botão "Copiar link" e garantindo que a URL reflita o card/rotina aberto.

## Passos

### 1. Novo componente `src/components/CopiarLinkButton.tsx`
Botão reutilizável que copia `window.location.origin + path` via Clipboard API com fallback `execCommand`, mostrando feedback (`toast` + ícone Check por 2s).

### 2. Compras — `src/routes/compras.index.tsx` + `src/components/CompraDialog.tsx`
- Confirmar que os helpers `abrirCard`/`limparUrlCard` já existem (aplicados em turno anterior). Se ausentes, aplicar o padrão de sincronização de `?id=`.
- No `DialogFooter` do `CompraDialog`, renderizar `<CopiarLinkButton path={`/compras?id=${compraId}`} />` quando `compraId` estiver definido (lado esquerdo, junto ao Excluir).

### 3. Despesas — `src/routes/financeiro.index.tsx` + `src/components/DemandaDialog.tsx`
- Importar `useEffect` e adicionar:
  - `useEffect` que lê `?id=` na montagem e chama `setEditId` + `setOpen(true)`.
  - Helpers `abrirCard(id)` e `limparUrlCard()` usando `window.history.replaceState`.
- Substituir os dois `onClick`/`onOpen` de abertura de card por `abrirCard(c.id)`.
- `onOpenChange` do `DemandaDialog`: ao fechar, limpar `editId` e chamar `limparUrlCard()`.
- Botões "Nova demanda" e "+ adicionar" chamam `limparUrlCard()` antes de abrir.
- No `DialogFooter` do `DemandaDialog`, renderizar `<CopiarLinkButton path={`/financeiro?id=${demandaId}`} />` quando houver `demandaId`.

### 4. Rotinas Financeiras — `src/routes/financeiro.rotinas.tsx`
- Garantir `useEffect` importado.
- `useEffect` dependente de `rotinas`: se `?rotina=<id>` estiver presente e a rotina existir na lista, chamar `setEditing(r)`.
- Ao lado do botão "Compartilhar com Maicon" de cada rotina, adicionar `<CopiarLinkButton path={`/financeiro/rotinas?rotina=${r.id}`} label="" variant="ghost" size="icon" />`. O `shareWithMaicon` permanece intacto.

## Restrições
- Sem `localStorage`/`sessionStorage`; apenas `window.history.replaceState`.
- Não alterar permissões, movimentação ou lógica de notificação.
- Não remover `shareWithMaicon`.
- Não tocar em outros módulos.

## Verificação
- Abrir card em Compras/Despesas → URL ganha `?id=`; recarregar mantém o dialog aberto; botão copia link com toast.
- Acessar `/financeiro/rotinas?rotina=<id>` → abre a rotina para edição.
- Fechar dialog remove o parâmetro da URL sem recarregar a página.
