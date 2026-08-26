# Botão "Atualizar" em cada card do Painel Financeiro

Cada um dos 6 cards (Receita Bruta, Pot. de Vendas, Despesas, Custos, Investimentos e Lucro) ganha um botão discreto de atualizar, como o que já existe nas categorias do demonstrativo. Ao clicar, o sistema varre o ano inteiro selecionado direto no Conta Azul, importa o que estiver faltando e recalcula os indicadores e gráficos na tela.

## O que o botão faz

1. Varre no Conta Azul todos os títulos com vencimento no ano selecionado — recebimentos e pagamentos — e compara as liquidações com o que está gravado aqui.
2. Importa/corrige o que estiver divergente: títulos ausentes, baixas faltantes e rateios desatualizados.
3. Recarrega os dados do painel: cards, gráfico de receitas, custo de operação x receita, comparativos e demonstrativo.

Diferença por card:

- Receita Bruta: varre apenas recebimentos (contas a receber).
- Pot. de Vendas, Despesas, Custos, Investimentos: varrem apenas pagamentos (contas a pagar), pois são grupos de saída.
- Lucro: varre os dois lados (recebimentos e pagamentos), já que depende de tudo.

Durante a execução o card mostra um indicador de progresso ("3/12 meses" ou "180/420 lançamentos") e, ao final, um aviso com o resumo: quantos foram importados, corrigidos e se houve falhas.

## Comportamento e limites

- A varredura é por ano completo (jan–dez do ano em exibição no painel), independentemente do mês filtrado.
- Como pode demorar, o processamento é feito em lotes pequenos, com o botão desabilitado enquanto roda; só um card por vez.
- Se não houver nada a corrigir, aparece "Painel já está em dia com o Conta Azul".
- Nada é apagado: a rotina só grava/atualiza títulos, baixas e rateios vindos do Conta Azul.

## Detalhes técnicos

- Reutiliza a rota `/api/contaazul/conferencia` (já criada): `acao: "conferir"` para detectar divergências no ano e `acao: "corrigir"` (com `permitirNovos`) para importar/reprocessar em lotes de 40 IDs.
- Novo componente `CardRefreshButton` em `src/components/financeiro/ContaAzulDashboard.tsx`, com prop `escopo: "receber" | "pagar" | "ambos"`, encapsulando: conferir ano → corrigir em lotes → invalidar queries.
- `KpiCard` recebe uma prop opcional `action?: React.ReactNode` renderizada no canto superior direito (oculta na impressão via `print:hidden`), sem alterar o layout atual dos 6 cards.
- Ao concluir, invalida as queries `ca-baixas`, `ca-pagar`, `ca-receber`, `ca-rateios-caixa` e `ca-extrato`, o que recalcula automaticamente KPIs, gráficos (Receitas do período, Custo de operação x Receita), comparativo ano anterior e demonstrativo.
- O botão só aparece para quem tem permissão de administração do Conta Azul (mesma verificação já usada nas ações de sincronismo); para os demais, fica oculto.
