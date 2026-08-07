# Corrigir erro ao aprovar/negar card em "Pendente Aprovação"

## O que está acontecendo

O Maicon **tem** a permissão certa (ele é o responsável configurado de "Pendente Aprovação", tanto na regra do app quanto na regra do banco). O bloqueio não é de permissão.

Ao mover de "Pendente Aprovação" para "Aprovada", o banco exige um **novo prazo** para a compra aprovada. A tela de Compras não pede esse prazo em nenhum momento (nem no arrastar, nem no botão "Avançar"), então a operação sempre falha — e a mensagem exibida é a genérica "Você não tem permissão para mover este card, ou a ação foi bloqueada.", que confunde e parece um problema de permissão.

## O que será feito

1. **Pedir o prazo ao aprovar**: ao mover um card de "Pendente Aprovação" para "Aprovada" (arrastando ou pelo botão Avançar), abrir um diálogo curto pedindo a nova data de prazo (pré-preenchida com uma sugestão editável). Só depois de confirmar é que o card é movido.
2. **Negar não pede prazo**: mover para "Negada" continua direto, sem diálogo.
3. **Mensagens de erro reais**: em vez da frase genérica, exibir a mensagem que o servidor devolveu (ex.: "Informe o novo prazo…", "Apenas o responsável por Pendente Aprovação pode aprovar ou reprovar este card."), caindo na mensagem genérica só quando não houver texto.

## Sem mudanças de permissão

Nenhuma regra de acesso, política do banco ou responsável configurado será alterada. Maicon segue como aprovador de "Pendente Aprovação".

## Detalhes técnicos

- `src/routes/compras.index.tsx`: novo estado/diálogo de prazo acionado em `advanceToStatus`/`onDragEnd` quando `compra.status === "pendente_aprovacao"` e `status === "aprovada"`; o valor escolhido é passado como `opts.prazo` → `p_prazo` na RPC `move_compra_status`.
- `moveStatus.onError`: usar `error.message` do Postgres quando disponível.
- Nenhuma migração SQL.
