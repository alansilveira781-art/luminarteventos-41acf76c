# Receitas lançadas direto no banco (Conta PJ Conta Azul IP)

## O que já foi verificado agora

- O painel soma receita a partir de `ca_contas_receber` + `ca_lancamento_baixas` (liquidações), nunca do extrato.
- A sincronização de "Extrato Bancário" **não traz lançamentos**: ela só grava o saldo atual de cada conta financeira. Hoje são 40 linhas em `ca_extrato`, todas com data 26/08/2026 e valor 0,00 — inclusive a linha "Conta PJ Conta Azul IP".
- Nem `ca_contas_receber` nem `ca_lancamento_baixas` guardam a conta bancária da liquidação, então hoje é impossível conferir quanto entrou por cada conta.

Conclusão: se a receita foi registrada no Conta Azul apenas como um lançamento na conta bancária (sem título em Contas a Receber), ela **não** está sendo contabilizada. Se ela existe como título recebido, está contabilizada — mas não conseguimos provar isso por conta bancária com os dados atuais.

## Plano

### 1. Diagnóstico direto na API (primeiro passo, antes de qualquer mudança)
- Consultar a API do Conta Azul com o token conectado buscando o extrato/lançamentos da conta "Conta PJ Conta Azul IP" num mês de referência (ex.: agosto/2026).
- Comparar cada entrada de crédito dessa conta com o que existe em `ca_lancamento_baixas` do mesmo período.
- Resultado esperado do diagnóstico: lista de créditos que existem no banco e não existem no nosso banco de dados, com valor total da diferença.

### 2. Gravar a conta bancária nas liquidações
- Adicionar `conta_bancaria` (e id da conta) em `ca_lancamento_baixas`, preenchido no sincronismo a partir do detalhe da baixa.
- Permite, daqui em diante, conferir recebimento por conta e identificar rapidamente divergências.

### 3. Importar os lançamentos avulsos do banco (se o diagnóstico confirmar a lacuna)
- Trocar a sincronização de extrato: em vez de só saldo, percorrer cada conta financeira e gravar os lançamentos do período em `ca_extrato` (data, valor, tipo, categoria, centro de custo, descrição).
- Marcar os lançamentos que já têm título correspondente (conciliados) para não somar duas vezes.
- No DRE/painel, somar apenas os créditos **não conciliados** com categoria de receita, junto das baixas de contas a receber.

### 4. Conferência
- Reprocessar agosto/2026 e comparar o total de Receita Bruta antes/depois, informando exatamente quanto entrou de receita avulsa de banco.

## Detalhes técnicos

- Arquivos: `src/lib/conta-azul/sync.server.ts` (`syncExtrato`, gravação de baixas), `src/lib/conta-azul/dre.ts` (`calcularIndicadoresCaixa` / `expandirBaixas`), `src/components/financeiro/ContaAzulDashboard.tsx` (consulta de extrato).
- Migração: colunas novas em `ca_lancamento_baixas` e em `ca_extrato` (`conciliado`, `lancamento_external_id`), com índice por data.
- Se a API v2 não expuser extrato por conta, o passo 3 muda: a conciliação passa a ser feita por saldo/transferências e eu reporto essa limitação antes de implementar.
