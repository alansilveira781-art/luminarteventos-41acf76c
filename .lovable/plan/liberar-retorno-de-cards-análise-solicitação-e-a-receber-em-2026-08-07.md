# Liberar retorno de cards (Análise → Solicitação e A Receber → Em Andamento)

## Situação atual (verificada)

- Natanael tem acesso aos módulos **Compras** e **Financeiro (Despesas)**, sem ser admin de módulo, e está configurado como responsável dos status Solicitação, Análise, Aprovada, Em Andamento e Finalizado em Compras.
- Em **Compras**, o card só pode ir para o **próximo** status da sequência. Essa trava existe em dois lugares: na regra do aplicativo e também numa regra no banco de dados. Por isso voltar de Análise para Solicitação, ou de A Receber para Em Andamento, é bloqueado com mensagem de "movimentação inválida".
- Em **Despesas**, o quadro não tem trava de sequência no aplicativo e as permissões do banco já permitem que quem tem o módulo mova o card. Ou seja, o retorno já deveria funcionar; se ainda falhar, é um caso a reproduzir e não uma regra de sequência.

## O que será feito

1. **Compras — permitir dois retornos específicos**, e somente eles:
   - Análise → Solicitação de Compra
   - A Receber → Em Andamento

   Quem pode: admin (como hoje) e o usuário que for responsável configurado do status de origem **ou** do status de destino (é o caso do Natanael nos dois pares). Nenhum outro retorno é liberado, e todo o resto do fluxo continua igual.

2. **Banco de dados** — a mesma exceção precisa ser liberada na regra do banco, senão a ação continua sendo recusada mesmo com o botão habilitado.

3. **Despesas** — confirmar o retorno equivalente (Análise → Solicitação de Despesa e A Receber → Em Andamento) no quadro atual. Se já funcionar, nada muda. Se houver bloqueio, o ajuste será do mesmo tipo e restrito a esses dois pares.

Nada mais é alterado: prazos, notificações, aprovação, migração para despesa, dashboards e demais módulos ficam como estão.

## Detalhes técnicos

- `src/lib/compras.ts` → `canMoveCompra`: antes da checagem `targetStatus !== nextCompraStatus(currentStatus)`, aceitar os pares de retorno `["analise","solicitacao"]` e `["a_receber","em_andamento"]` quando o usuário for responsável de origem ou destino (ou admin). Pedro continua com sua lista própria inalterada.
- Migração alterando `public.validate_compra_status_transition()`: adicionar, antes da checagem de `v_next_status`, um `RETURN NEW` para esses dois pares quando `auth.uid()` for `v_resp_origem` ou `v_resp_destino`.
- `src/routes/compras.index.tsx`: o cálculo de `canMove` para arrastar usa apenas o próximo status; passará a considerar também o status de retorno permitido, para o drag ficar habilitado. O botão "Avançar" continua apontando só para o próximo status.
- Despesas (`src/routes/financeiro.index.tsx`): sem regra de sequência hoje; apenas validar em execução.
