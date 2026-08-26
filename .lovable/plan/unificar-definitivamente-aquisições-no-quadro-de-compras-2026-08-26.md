# Unificar definitivamente Aquisições no Quadro de Compras

## Objetivo
Fazer todas as aquisições (`DEMANDA-...`) viverem no Quadro de Compras durante todo o ciclo, inclusive depois de finalizadas, sem reaparecerem no antigo Quadro de Aquisições.

## Situação confirmada
- O Quadro de Compras consulta aquisições, mas exclui explicitamente os status `finalizado` e `negada`.
- O antigo Quadro de Aquisições consulta todas as demandas, sem essa exclusão; por isso, ao finalizar, o card some de Compras e continua visível no quadro antigo.
- A base possui 241 demandas: 34 abertas e 207 finalizadas/negadas. As 34 abertas têm número e título válidos e atendem à consulta atual; demandas históricas são as que ficam fora por causa do filtro de status.

## Implementação
1. **Quadro de Compras como fonte única**
   - Remover a exclusão de demandas finalizadas/negadas na consulta unificada.
   - Manter os cards `DEMANDA-...` nas mesmas colunas das compras, incluindo `Finalizado` e `Negada`.
   - Preservar busca, filtros, seleção em massa, valores, edição, pagamentos, itens, anexos e comunicação com Estoque/Patrimônio.

2. **Finalização sem mudança de quadro**
   - Ajustar a atualização e invalidação do cache para que uma demanda finalizada permaneça imediatamente na coluna `Finalizado` do Quadro de Compras.
   - Garantir o mesmo comportamento ao mover por botão, arrastar, editar no diálogo ou executar ação em massa.

3. **Desativar o quadro antigo para operação**
   - Remover o antigo Quadro de Aquisições da navegação operacional e impedir que ele continue sendo o destino visual das demandas.
   - Manter os dados na tabela atual e os fluxos internos existentes; não haverá conversão destrutiva nem perda de histórico.

4. **Validação**
   - Conferir a quantidade de demandas por status no Quadro de Compras contra a base.
   - Testar uma demanda aberta até `Finalizado` e confirmar que ela permanece em Compras.
   - Testar busca por `DEMANDA-...`, filtros, abertura do card e ações em massa após a unificação.

## Detalhes técnicos
- A correção principal será em `src/routes/compras.index.tsx`, tornando a consulta de demandas abrangente e atualizando o cache local em vez de depender da antiga lista de “demandas abertas”.
- O acesso legado em `src/routes/financeiro.index.tsx` será retirado do fluxo de uso, sem apagar registros e sem alterar a integração das demandas com os demais módulos.
- Nenhuma migração de dados é necessária: os cards já estão na tabela correta; o problema confirmado é de filtro e destino de interface.