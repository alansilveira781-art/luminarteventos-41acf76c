## Diagnóstico confirmado

O pagamento **Comissão 05/2026** existe no banco com valor total **R$ 15.807,28** e 8 fatias de rateio iguais de **R$ 1.975,91**. Para o centro **46222 - STAND BRAHMA - SÃO JOÃO MARACANAU**, o demonstrativo mostra R$ 1.975,91 porque está lendo essa fatia antiga.

O reprocessamento não corrigiu esse item porque a fila atual ordena por `detalhe_synced_at ASC NULLS FIRST`, mas há **45.050 contas a pagar sem detalhe** antes dele; esse lançamento está na posição **26.634** da fila. Além disso, o modo “Somente suspeitos” só analisa os primeiros 200 itens do pool e nesse pool há **0 suspeitos**, mesmo existindo **1.895 suspeitos** no total. Por isso o botão parece rodar e não chegar no lançamento correto.

## Plano de correção

1. **Corrigir a seleção de candidatos do reprocessamento**
   - No modo `suspeitos`, buscar diretamente lançamentos com múltiplas fatias de mesmo valor, em vez de olhar apenas os primeiros 200 por `detalhe_synced_at`.
   - Manter limite pequeno por chamada para não estourar tempo, mas garantir que suspeitos reais entrem na fila.

2. **Permitir reprocessamento direcionado por lançamento**
   - Adicionar no endpoint uma forma segura de reprocessar um lançamento específico quando já temos o `external_id`.
   - Usar isso para corrigir o lançamento `96686f15-b813-43ce-a57c-46f49692a5ec` sem depender de percorrer dezenas de milhares de registros.

3. **Corrigir parser do rateio retornado pelo Conta Azul**
   - Conferir o formato que o endpoint de detalhe retorna para esse lançamento.
   - Ajustar `buildRateios` para capturar corretamente valor/percentual quando o valor vem em outro campo ou estrutura, sem voltar para divisão igual.
   - Se o detalhe não trouxer valor por centro, preservar o rateio anterior e registrar falha clara, em vez de marcar como corrigido.

4. **Melhorar retorno da tela de reprocessamento**
   - Exibir detalhes de falha/sucesso no toast ou no card quando o lote não corrigir nada.
   - Evitar mensagem ambígua de “lote reprocessado” quando nenhum rateio foi efetivamente atualizado.

5. **Validar no banco e na UI**
   - Depois da correção, consultar o lançamento e confirmar se a fatia do centro **46222 - STAND BRAHMA - SÃO JOÃO MARACANAU** passa para **R$ 5.600,00**.
   - Confirmar que a Análise Detalhada deixa de mostrar **R$ 1.975,91** para essa comissão.