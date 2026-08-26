# Fechar as divergências de valores recebidos por mês

## O que a investigação mostrou

Comparando o Conta Azul com o banco para julho/2026:

- Recebimentos de Receita Bruta calculados a partir da API, considerando apenas títulos com vencimento entre maio e novembro/2026: **R$ 1.556.201,98**
- Valor exibido hoje no painel: **R$ 1.556.156,98**

Ou seja, o painel está fiel ao que foi sincronizado — o problema é **o que não foi sincronizado**. A diferença que você apontou (R$ 1.565.159,98 esperado) fica fora dessa janela de vencimento.

Causa provável, e é a mesma que gerou o buraco de agosto corrigido ontem: a sincronização busca os títulos **por data de vencimento**. Uma parcela vencida em 2025 (ou em 2027) que foi paga em julho/2026 simplesmente não entra na janela e, portanto, sua baixa nunca chega ao banco — mesmo o recebimento tendo acontecido no mês analisado.

Não consegui fechar a conta exata dos R$ 9.003 porque o token do Conta Azul expirou durante a apuração. Confirmar esse número é o primeiro passo do trabalho.

## Plano

### 1. Confirmar a causa (antes de mexer em qualquer cálculo)
Reconectar o Conta Azul e varrer todos os títulos a receber e a pagar de 2020 até 2028, listando as baixas por mês e comparando uma a uma com o banco. Isso produz, para cada mês de 2026, a lista exata de liquidações faltantes e o valor. Se a diferença de julho não for explicada por essa varredura, reporto o achado real antes de seguir.

### 2. Sincronizar por data de baixa, não só por vencimento
Hoje a busca usa apenas a janela de vencimento. Vou acrescentar uma varredura complementar que percorre uma faixa ampla de vencimentos (2020–2028) filtrando as alterações recentes, de modo que qualquer parcela liquidada no período analisado entre no banco, independentemente de quando ela vencia. Essa varredura roda tanto na sincronização completa quanto na reconciliação de recebidos e pagos.

### 3. Corrigir o histórico
Depois do ajuste, reprocessar 2026 inteiro (recebimentos e pagamentos) para trazer as baixas ausentes, já com a conta bancária preenchida.

### 4. Painel de conferência por mês
Na aba Conta Azul, um bloco novo "Conferência de liquidações": para cada mês, valor recebido/pago segundo o Conta Azul, valor no banco e a diferença, com botão para reprocessar o mês divergente. Assim você mesmo enxerga qualquer buraco futuro sem depender de auditoria manual.

### 5. Diferença de centavos por taxas
As baixas gravam o valor bruto; em julho há R$ 42,00 de taxas de cartão. Vou passar a guardar também o valor líquido e a taxa, para o painel poder mostrar bruto e líquido sem ambiguidade.

## Detalhes técnicos

- `src/lib/conta-azul/sync.server.ts`: nova passada de busca por `data_alteracao` sobre janela de vencimento ampla em `syncContasReceber`/`syncContasPagar`; `buildBaixas` passa a gravar `valor_liquido` e `taxa`.
- Migração: colunas `valor_liquido` e `taxa` em `ca_lancamento_baixas`.
- `src/routes/api/contaazul/reprocessar-rateios.ts` (modo `liquidacoes`): usar a mesma varredura ampla.
- Nova rota de auditoria (`/api/contaazul/conferencia`) devolvendo o comparativo mensal API x banco, consumida pelo bloco novo em `src/routes/financeiro-op.conta-azul.tsx`.
- Nenhuma mudança na fórmula do DRE — o critério continua sendo data de baixa.
