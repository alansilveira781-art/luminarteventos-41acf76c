
# Ajustar Painel Financeiro (Conta Azul) para a estrutura oficial do DRE

## Diagnóstico

Hoje o **Painel Financeiro** em `src/components/financeiro/ContaAzulDashboard.tsx` monta o demonstrativo de forma fictícia:
- "Custos = 80% das contas a pagar", "Despesas = 20%", "Deduções = 10% das receitas".
- Isso ignora completamente o plano de contas real e por isso os números não batem com o extrato que você puxou.

Olhando seus arquivos:

- **Estrutura.xlsx** define 24 linhas do DRE (Receita Bruta → Deduções → Receita Líquida → Aquisição de Clientes → Marketing → Comerciais → Resultado de Venda → Variáveis → Diretos → Indiretos → Resultado da Operação → Sócio → Administrativas → Tributárias → Resultado Gerencial → Receitas/Despesas Financeiras → Resultado Financeiro → Outras Entradas/Saídas → Resultado Não Operacional → Resultado do Negócio → Investimentos → Lucro), com 9 linhas de subtotal calculadas.
- **Plano de Contas.xlsx** confirma o padrão de prefixo no nome de cada conta (`RB - …`, `DR - …`, `AC - …`, `DM - …`, `DC - …`, `CV - …`, `CD - …`, `CI - …`, `DS - …`, `DA - …`, `DT - …`, `RF - …`, `DF - …`, `OE/OR - …`, `OS - …`, `IN - …`). Os dados já sincronizados em `ca_plano_contas` também seguem esse padrão (validado por query).
- **extrato_financeiro.xls** (Conta Azul) é a fonte de verdade do realizado por **data de movimento**, ignorando transferências entre contas (`Transferência de Entrada/Saída`) e considerando apenas lançamentos `Quitado/Conciliado`.

A divergência entre Painel e extrato vem de três coisas que o código atual não respeita:
1. Filtramos por `data_vencimento` (regime de competência sobre o vencimento) em vez de `data_pagamento` (caixa). O extrato é caixa.
2. Não excluímos lançamentos de transferência (que infla receita e despesa).
3. Receita e despesa são quebradas por percentual fixo em vez de agrupar pelo prefixo da conta.

## O que vou fazer

### 1. Mapear o plano de contas para o grupo do DRE
Criar `src/lib/conta-azul/dre.ts` com:
- A lista das 24 linhas de Estrutura.xlsx, marcando subtotal/sinal.
- Função `grupoDoPlano(nome)` que extrai o prefixo (`RB`, `DR`, `AC`, `DM`, `DC`, `CV`, `CD`, `CI`, `DS`, `DA`, `DT`, `RF`, `DF`, `OE`, `OR`, `OS`, `IN`) do `nome` da conta e devolve o id do grupo do DRE. Contas sem prefixo conhecido vão para "Sem classificação" (visível no DRE para você poder corrigir no Conta Azul).
- Função `montarDRE(contasPagar, contasReceber, planoMap, { ano, mes, regime })` que devolve as 24 linhas na ordem, com valor, subtotais calculados e % sobre Receita Bruta.

Regime padrão = **caixa** (usa `data_pagamento` e status pago/conciliado). Vou adicionar um toggle "Competência × Caixa" no Painel para você comparar com o extrato.

### 2. Excluir transferências e saldos iniciais
- Ignorar linhas cuja conta/categoria seja `Transferência de Entrada`, `Transferência de Saída` ou `Saldo Conta Bancária`.
- Ignorar pagamentos cancelados.

### 3. Refazer o Painel Financeiro
Reescrever `PainelFinanceiro` em `ContaAzulDashboard.tsx`:
- Toggle **Regime: Caixa / Competência**.
- KPIs (Receita Bruta, Receita Líquida, Resultado da Operação, Resultado Gerencial, Lucro) calculados a partir do DRE real.
- Tabela do DRE mostrando as 24 linhas da Estrutura, com as contas detalhadas indentadas embaixo do grupo correto, e % sobre Receita Bruta.
- "Movimentos" continua, mas filtrado pelo mesmo regime.

### 4. Card de Reconciliação com Extrato
Adicionar card "Conferência vs Extrato" no Painel:
- Total de receitas e despesas do período em `ca_extrato` (que veio do Conta Azul, com a mesma regra de exclusão de transferência).
- Total do DRE (caixa) por Receita Bruta e Despesas+Custos.
- Diferença em R$ e %. Linha verde se ≤ 1%, amarela ≤ 5%, vermelha acima — assim você vê de cara onde tem buraco e em qual recurso (a pagar, a receber ou extrato).
- Botão "Ver detalhes" lista os meses onde a diferença passa de 5%, para você cruzar com a aba "Meses com falha" da sincronização.

### 5. Aplicar a mesma estrutura na Análise Detalhada
A aba **Análise Detalhada** (por evento/centro de custo) hoje só mostra Receita e Custo. Vou rodar o mesmo `montarDRE` filtrando por `centro_custo_external_id`, para que cada projeto tenha o demonstrativo completo na estrutura oficial.

## Arquivos afetados

- `src/lib/conta-azul/dre.ts` *(novo)* — estrutura do DRE, prefixos e função `montarDRE`.
- `src/components/financeiro/ContaAzulDashboard.tsx` — substitui o cálculo simplificado, adiciona toggle de regime, card de reconciliação e aplica DRE na Análise Detalhada.

## O que NÃO vou fazer agora (e por quê)

- Não vou alterar a sincronização nem o schema de `ca_plano_contas` — o prefixo do nome já é suficiente para mapear o grupo, sem migração.
- Não vou importar o `extrato_financeiro.xls` manualmente: a tabela `ca_extrato` já é alimentada pela sincronização do Conta Azul e é a fonte usada no card de reconciliação. Se a reconciliação acusar buraco em algum mês, o caminho é reprocessar aquele mês pelo card "Meses com falha" que já existe.

## Pergunta antes de implementar

Você quer o regime **caixa** como padrão do Painel (que é o que bate com o extrato), ou prefere **competência** (vencimento) como padrão e caixa como toggle?
