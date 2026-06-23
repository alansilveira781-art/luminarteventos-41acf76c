## Objetivo
No módulo Estoque → aba "A receber", exibir o número da compra (COMPRA-XX) no card e trazer informações de solicitante e evento/projeto ao abrir o "Validar recebimento".

## Mudanças (todas em `src/routes/estoque.a-receber.tsx`)

### 1. Card da lista (canto superior direito: COMPRA-XX)
- Adicionar `numero` e `solicitante` ao type `CompraRow` e ao `.select(...)` da query `compras-receber`.
- Mudar o cabeçalho do `Card` para um flex row: título à esquerda, badge `COMPRA-{numero}` (ou `—`) à direita, em estilo discreto (mono, `text-xs text-muted-foreground`), igual ao usado no quadro de Compras (`src/routes/compras.index.tsx`).

### 2. Dialog "Validar recebimento" — campo Solicitante (informativo)
- Adicionar `numero` e `solicitante` ao `.select(...)` da query `compra-receber-info` e ao tipo retornado.
- Mostrar no topo do dialog (junto aos dados gerais, antes do bloco de inputs) uma linha informativa apenas-leitura:
  - `COMPRA-{numero}` · `Solicitante: {solicitante ?? "—"}`
- Também atualizar o `DialogTitle` para incluir o número: `Validar recebimento — COMPRA-{numero}`.

### 3. Evento/Projeto por item → Observações da movimentação
- Adicionar `evento_projeto` à seleção em `compra_itens` (query `compra-itens`) e ao type `CompraItemRow`.
- Mostrar `EVENTO/PROJETO: {evento_projeto}` como linha informativa dentro do card de cada item no dialog (abaixo de "Pedido: …"), só quando preenchido.
- Na criação de cada `movimentacoes` no `finalizar`, concatenar ao campo `observacoes` o sufixo ` — EVENTO/PROJETO: {evento_projeto}` quando o item tiver esse valor. Cada movimentação registra o evento do seu próprio item.

## Fora de escopo
- Não alterar schema, RLS, permissões, nem o fluxo de finalização da compra.
- Não mexer no módulo Compras nem em outras telas.
