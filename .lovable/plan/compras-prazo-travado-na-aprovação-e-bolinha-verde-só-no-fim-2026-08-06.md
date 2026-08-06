# Compras: prazo travado na aprovação e bolinha verde só no fim

## O que muda

1. **Pendente Aprovação não pede mais prazo novo.** Ao mover de Pendente Aprovação para Compras Aprovada, o card avança direto — sem a janela pedindo novo prazo. O prazo original continua valendo.
2. **Prazo congela na aprovação.** A partir de Compras Aprovada, o campo de prazo fica somente leitura no card (só admin não muda isso; ninguém edita). Antes da aprovação, continua editável normalmente.
3. **Bolinha.** Do status Aprovada até antes de Finalizado, a bolinha nunca aparece verde: mostra vermelho se o prazo venceu e amarelo caso contrário. Quando o card chega em Finalizado, a bolinha fica verde.

Cards já existentes que tenham um prazo pós-aprovação gravado continuam usando esse valor; nada é apagado.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: remover o uso do `PrazoAprovacaoDialog` em `advanceToStatus` e no drag-and-drop; a transição `pendente_aprovacao → aprovada` chama a RPC sem `p_prazo`. Excluir `src/components/compras/PrazoAprovacaoDialog.tsx`.
- `src/lib/prazo.ts`: novo helper `prazoStatusCompra(prazo, status)` — retorna `ok` (verde) somente quando `status === 'finalizado'`; para `aprovada`/`em_andamento`/`a_receber` retorna `vencido` ou `proximo`; antes disso usa `prazoStatus` normal. Manter `prazoVigente` como está (COALESCE prazo_aprovacao/prazo).
- `src/components/PrazoDot.tsx`: aceitar prop opcional `status` e usar o helper acima quando informada.
- Usos atualizados: lista de cards em `compras.index.tsx`, `CompraDialog` e `financeiro-op.quadro.tsx` (passar o status da compra).
- `CompraDialog`: quando o status for `aprovada` ou posterior, renderizar os campos de prazo como somente leitura (`disabled`), sem input editável de `prazo_aprovacao`.
- Sem migração de banco: a coluna `prazo_aprovacao` permanece, apenas deixa de ser preenchida por esse fluxo.
