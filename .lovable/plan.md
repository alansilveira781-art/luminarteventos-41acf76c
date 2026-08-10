# Aprovar compra sem pedir prazo

## O que muda

Ao mover um card de **Pendente Aprovação** para **Compras Aprovada** (arrastando ou pelo botão Avançar), a janela pedindo uma nova data de prazo deixa de aparecer. O card avança direto e o prazo já informado na solicitação continua valendo.

No Quadro de Despesas não há pedido de prazo em nenhuma transição — nada muda lá.

Cards já aprovados que tenham um prazo pós-aprovação gravado continuam usando esse valor; nada é apagado.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: remover o estado `prazoAsk`, o `Dialog` de prazo (linhas ~205, ~270, ~518-545) e a ramificação em `advanceToStatus`/drag-and-drop que o dispara; a chamada da RPC segue sem `p_prazo`.
- Migração: recriar `public.move_compra_status(p_id, p_status, p_responsavel_id, p_responsavel_nome, p_prazo)` removendo a exceção `'Informe o novo prazo para a compra aprovada.'`. O parâmetro `p_prazo` permanece opcional (grava em `prazo_aprovacao` quando enviado) e o registro em `compra_historico` só é criado quando um prazo for informado.
- Coluna `prazo_aprovacao` e o helper `prazoVigente` permanecem como estão.
