# Remover a alça de arrastar dos cards do quadro de Compras

Hoje o card inteiro já pode ser arrastado, então o ícone de pontinhos (⋮⋮) à esquerda é redundante e rouba espaço do título.

## Mudança

- Remover o ícone ⋮⋮ dos cards do quadro de Compras.
- Reaproveitar o espaço: o título e o código (COMPRA-XX) passam a ocupar a largura liberada, com o checkbox de seleção seguindo alinhado à primeira linha.
- Nada muda no comportamento: arrastar o card por qualquer parte continua funcionando (e segue bloqueado para quem não tem permissão, apenas sem o ícone esmaecido como pista).

Se quiser, aplico a mesma limpeza nos outros quadros que ainda mostram o ⋮⋮ (Comercial, Jurídico, Quadro Financeiro, RH, Financeiro) — hoje o plano cobre só Compras.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: excluir o `<span aria-hidden>⋮⋮</span>` (linhas ~697-701) do card; manter `listeners`/`attributes` no container do card.
