**Diagnóstico**
- A configuração atual está correta: Natanael é responsável por `Solicitação` e `Análise`; Maicon é responsável por `Pendente Aprovação`.
- A regra atual ficou permissiva demais: ela permite mover se o usuário for responsável pelo status de origem **ou** pelo status de destino. Como Natanael é responsável por vários status posteriores, ele acaba conseguindo mover entre status que não deveria.
- O bloqueio ao mover de `Análise` para `Pendente Aprovação` acontece porque o front-end ainda mistura a lógica de destino com a lógica especial de aprovação.

**Regra que vou aplicar**
1. O responsável do status atual pode mover o card **somente para o próximo status operacional**.
   - Ex.: Natanael em `Análise` pode empurrar para `Pendente Aprovação`.
2. O responsável do status de destino pode “puxar” o card para o seu status.
   - Ex.: Maicon pode puxar para `Pendente Aprovação`.
3. Em `Pendente Aprovação`, somente o responsável desse status, Maicon, pode aprovar ou reprovar.
   - Natanael não poderá mover de `Pendente Aprovação` para `Aprovada`, `Negada` ou qualquer outro status.
4. Admins continuam com permissão total.
5. Pedro mantém a regra especial já existente: apenas `Solicitação → Análise` e `Análise → Pendente Aprovação`.

**Mudanças técnicas**
- Ajustar `validate_compra_status_transition` no banco para validar transições usando a sequência real dos status, com exceção específica para aprovar/reprovar a partir de `Pendente Aprovação` apenas pelo responsável desse status.
- Ajustar a política de atualização da tabela `compras` para permitir persistência quando o usuário for responsável pelo status atual do card ou pelo status de destino, sem abrir permissão para transições inválidas; a trigger continuará sendo a trava final.
- Atualizar `canMoveCompra` em `src/lib/compras.ts` para espelhar exatamente a mesma regra do banco.
- Corrigir as chamadas em `src/routes/compras.index.tsx` e `src/components/CompraDialog.tsx` para sempre passar o responsável do status atual e do destino ao calcular permissões.
- Melhorar a mensagem de bloqueio para indicar quando só o responsável do próximo status/status atual pode mover.

**Validação**
- Conferir no banco que Natanael consegue mover `Análise → Pendente Aprovação`.
- Conferir que Natanael não consegue mover de `Pendente Aprovação → Aprovada/Negada` nem pular para status posteriores.
- Conferir que Maicon consegue atuar em `Pendente Aprovação`.
- Conferir que o front-end não mostra arraste/botão liberado quando o banco bloquearia a ação.