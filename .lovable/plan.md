# Impressão da DRE do mês no Painel Financeiro

Hoje só a Análise Detalhada permite imprimir. O Painel Financeiro (aba Dashboard do Financeiro) passa a gerar dois relatórios em PDF do mês/ano selecionado.

## Botões

Ao lado dos seletores de Ano e Mês, um botão "Exportar PDF" com duas opções:

- Relatório Analítico
- Relatório Estratégico

## Relatório Analítico

- Cabeçalho: "Grupo Luminart — DRE (regime de caixa)", mês/ano e data de geração.
- Tabela do Demonstrativo com todos os grupos abertos, mostrando as categorias de cada grupo, as linhas de resultado e a linha de Lucro, com colunas Demonstrativo / Valores / %.
- Tabela de Lançamentos do período: Data, Fornecedor/Cliente, Descrição, Valor, com linha de total.
- Rodapé com numeração de páginas.

## Relatório Estratégico

- Mesmo cabeçalho.
- Faixa de indicadores: Receita Bruta (com % vs. ano anterior), Potencial de Vendas, Despesas, Custos e Lucro, com os respectivos percentuais sobre a Receita Bruta.
- DRE resumido: apenas as linhas de grupo e de resultado (sem abrir categorias, sem lançamentos), com valores e %.
- Rodapé com numeração de páginas.

Os dois relatórios respeitam exatamente o mês/ano selecionados na tela e os mesmos números exibidos nos cartões e no Demonstrativo.

## Detalhes técnicos

- Novo arquivo `src/lib/conta-azul/dre-relatorio.ts` com `gerarDrePdf({ tipo: "analitico" | "estrategico", ano, mes, kpis, linhas, lancamentos })`, usando `jspdf` + `jspdf-autotable` (já usados em `src/lib/comercial/vendas-relatorio.ts`), carregados sob demanda.
- Em `PainelFinanceiro` (`src/components/financeiro/ContaAzulDashboard.tsx`): montar as linhas do DRE sempre expandidas para o analítico (independente do estado `collapsed` da tela) e passar `lancamentos` completos (não o filtro de categoria ativo).
- Nome do arquivo: `dre-analitico-2026-08.pdf` / `dre-estrategico-2026-08.pdf`.
- Sem mudanças de banco, de cálculo do DRE ou do layout da tela.
