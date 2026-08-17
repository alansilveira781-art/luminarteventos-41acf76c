# Impressão do Painel Financeiro (Dashboard)

Adicionar um botão **Imprimir** na aba "Painel Financeiro" do Dashboard do Financeiro que gera um relatório em papel (A4) sem alterar nada da tela em uso.

## Como vai funcionar

- Botão "Imprimir" ao lado dos filtros de Ano/Mês (mesmo estilo da DRE Detalhada).
- Ao clicar, o sistema monta o relatório apenas para a impressão:
  - Cabeçalho com "Painel Financeiro — <Mês>/<Ano>", empresa e data/hora de geração.
  - Faixa com os 5 indicadores (Receita Bruta, Pot. de Vendas, Despesas, Custos, Lucro) com seus percentuais.
  - Demonstrativo (DRE) completo, com todos os grupos expandidos e a linha de Lucro no final.
  - Lançamentos do período (respeitando o filtro de categoria ativo, se houver), com o total no rodapé.
- A interface na tela não muda: nada de novos blocos, o layout de impressão só existe durante o `window.print()` e é desfeito logo depois.
- Sem cortes: tabelas rolantes ficam com altura livre na impressão, cores preservadas e quebra de página controlada para não partir linhas no meio.

## Detalhes técnicos

Arquivo: `src/components/financeiro/ContaAzulDashboard.tsx` (componente `PainelFinanceiro`).

- Reaproveitar o mesmo padrão já usado em `AnaliseDetalhada`:
  - bloco `<style>` com `@media print` e a classe de estado no `body` (ex.: `printing-painel`), escondendo tudo fora do portal de impressão;
  - clonar as seções (KPIs + DRE + Lançamentos) para um `div.print-portal`, imprimir e remover no `afterprint` (com fallback por `setTimeout`).
- Antes de clonar, expandir temporariamente todos os grupos do DRE (`setCollapsed({})`) para o relatório sair completo, restaurando o estado do usuário depois.
- Cabeçalho de impressão renderizado com `hidden print:block` dentro do bloco clonado.
- Orientação A4 retrato com `@page { size: A4 portrait; margin: 10mm }`; se as colunas de Lançamentos ficarem apertadas, usar paisagem.
- Nenhuma mudança em consultas, cálculos ou dados.
