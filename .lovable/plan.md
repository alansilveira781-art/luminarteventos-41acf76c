## Objetivo

Ao clicar em "Imprimir" na Análise Detalhada, o PDF deve conter **apenas o card do Demonstrativo (DRE)** — sem KPIs, sem tabela de lançamentos, sem filtros, sem cabeçalho da tela, sem sidebar.

## Diagnóstico atual

Hoje o `window.print()` imprime a página inteira e o CSS `@media print` só ajusta layout, sem esconder as outras seções. Resultado: sai um "screenshot" da tela com sidebar, KPIs, filtros e tabela de lançamentos misturados.

## Mudanças em `src/components/financeiro/ContaAzulDashboard.tsx`

1. **Marcar o card do Demonstrativo com uma classe alvo** (ex: `print-target`) e envolver todo o resto da Análise Detalhada (KPIs, filtros, botão imprimir, card de lançamentos, cabeçalho de página) com `print:hidden` — ou aplicar via CSS `@media print { body > *:not(.print-root) { display: none } }` usando um wrapper controlado.

2. **Abordagem escolhida (mais robusta):** no clique de Imprimir, adicionar temporariamente uma classe `printing-dre` no `<body>`. O CSS `@media print` com `body.printing-dre` esconde tudo (`body.printing-dre *:not(.print-keep):not(.print-keep *) { display: none }`) e mostra apenas o card `.print-keep` (o Demonstrativo) posicionado no topo da página. Após `window.print()` (ou no evento `afterprint`), remove a classe.

3. **Manter o cabeçalho de impressão** (Luminarte + data) apenas dentro do próprio card `.print-keep`, para aparecer acima do DRE no PDF.

4. **Manter expansão automática** dos grupos DRE antes de imprimir e restauração depois (já implementado).

5. **Ajustes de CSS `@media print`:**
   - `@page { size: A4 portrait; margin: 12mm; }` (retrato basta, é só uma coluna).
   - `-webkit-print-color-adjust: exact; print-color-adjust: exact;` para preservar fundos cinza dos cabeçalhos das rubricas.
   - `.print-keep { width: 100%; box-shadow: none; border: none; }`
   - `page-break-inside: avoid` em cada linha de rubrica.
   - Font-size 10pt, padding reduzido.
   - Remover as regras antigas `.kpi-grid` / `.print-two-cols` que forçavam grid — não são mais necessárias.

6. **Remover** o bloco de KPIs do "print header" atual (foi adicionado na iteração anterior) — o usuário quer só o DRE.

## Verificação

Ctrl+P na Análise Detalhada → preview mostra apenas o Demonstrativo em uma página A4 retrato, com todas as rubricas expandidas, cabeçalhos cinza visíveis, sem sidebar, sem KPIs, sem tabela de lançamentos.

## Fora de escopo

- Sync de dados 2027+ (assunto separado, pendente de ação do usuário).
- Layout da tela (não-print) permanece igual.
