## Contexto

`calcularDRECaixa` em `src/components/financeiro/ContaAzulDashboard.tsx` é usada em dois lugares:
- Linhas 260/265 → **Painel Financeiro** (DRE geral do mês) — deve continuar em caixa.
- Linha 818 → **Análise Detalhada** (por evento/centro de custo) — passar para competência.

A lista `lancamentos` (linha 866) é exclusiva da Análise Detalhada.

Como a função é compartilhada, adiciono um parâmetro `regime` para não afetar o Painel Financeiro.

## Mudanças em `src/components/financeiro/ContaAzulDashboard.tsx`

### 1. Regime de competência na Análise Detalhada

- `calcularDRECaixa(..., regime: "caixa" | "competencia" = "caixa")`:
  - Se `regime === "caixa"`: comportamento atual (`status === "pago"`, período por `data_pagamento ?? data_vencimento`).
  - Se `regime === "competencia"`: remove o filtro de status e usa `data_vencimento` como data de referência do período. Demais regras (transferências, centro de custo, ids permitidos, grupos) inalteradas.
- Chamadas 260 e 265 (Painel Financeiro): sem alteração (default `"caixa"`).
- Chamada 818 (Análise Detalhada): passar `"competencia"`. Como já usa `ano=0, mes=0`, o filtro de data continua não restringindo — mas agora o critério "pago" some, então lançamentos parcelados aparecem pelo valor total.
- Bloco `lancamentos` (linha 866): remover `if (c.status !== "pago") return;` e usar `dataRef = c.data_vencimento`. Manter `isTransferencia` e o rateio.

Renomear o comentário/docstring da função (deixa de ser exclusivamente "regime de caixa").

### 2. Botão Imprimir na Análise Detalhada

- Adicionar botão **Imprimir** no cabeçalho da Análise Detalhada (perto do seletor de centro de custo), chamando `window.print()`.
- Envolver a área do demonstrativo (nome do centro de custo + DRE por grupos + lançamentos detalhados + totais) em um container com classe `print-area` (visível na impressão). Aplicar `print:hidden` nos filtros, seletores, tabs e navegação.
- Adicionar bloco de cabeçalho de impressão (só visível em `@media print`) com nome da empresa (Luminarte Eventos), nome do evento/centro de custo selecionado e data de emissão.
- Reutilizar o padrão de CSS de impressão já usado em `src/routes/financeiro-op.relatorios.tsx` (bloco `<style>` com `@media print { ... }` inline no componente, ocultando `.no-print` e exibindo `.print-only`).

## Verificação

1. Lançamento parcelado (10x, nenhuma parcela paga) na Análise Detalhada aparece pelo valor total no DRE do evento e na lista de lançamentos.
2. Painel Financeiro (DRE geral do mês) continua idêntico (regime de caixa).
3. Botão Imprimir gera versão limpa com cabeçalho da empresa, nome do centro de custo, DRE e lançamentos, sem filtros/navegação.
