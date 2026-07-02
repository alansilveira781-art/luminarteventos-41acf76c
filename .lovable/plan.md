## Adicionar impressão ao relatório "Vendas por Período"

Adicionar botão **Imprimir** no cabeçalho do relatório `RelatorioVendasPeriodo` (ao lado do "Exportar CSV"), abrindo o diálogo de impressão do navegador com um layout otimizado para papel.

### Arquivo alterado
- `src/components/comercial/RelatorioVendasPeriodo.tsx`

### Mudanças

1. **Botão Imprimir**
   - Novo botão `variant="outline"` com ícone `Printer` (lucide-react), ao lado do "Exportar CSV".
   - `onClick={() => window.print()}`.

2. **Área imprimível**
   - Envolver todo o conteúdo do relatório num `<div ref={printRef} className="print-area">`.
   - Cabeçalho de impressão (visível só na impressão, via `hidden print:block`): título "Relatório de Vendas por Período", os dois intervalos (Período A e Período B) e data de geração.

3. **Estilos de impressão (Tailwind utilitários `print:`)**
   - Ocultar na impressão: barra de filtros de datas, botões (CSV/Imprimir) — via `print:hidden`.
   - `print:break-inside-avoid` nos Cards de KPI, gráfico e cada ranking, para evitar quebras no meio.
   - Gráfico com altura fixa em `print:h-64` e cores garantidas com `print-color-adjust: exact` (classe utilitária inline).
   - Grid dos rankings força `print:grid-cols-2` (mantém layout compacto em A4).
   - Tabelas com `print:text-xs` para caber melhor.

4. **Regra global mínima** (inline `<style>` dentro do componente, escopado por `@media print`)
   - `@page { size: A4; margin: 12mm; }`
   - `body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`
   - Ocultar tudo fora de `.print-area` durante a impressão:
     ```
     @media print {
       body * { visibility: hidden; }
       .print-area, .print-area * { visibility: visible; }
       .print-area { position: absolute; inset: 0; }
     }
     ```
   Isso garante que apenas o relatório seja impresso, mesmo com sidebar/tabs/headers da aplicação em volta.

### Não fazer
- Não alterar dados, filtros, métricas nem `listVendasDb`.
- Não mexer no relatório "Distribuição de Comissão".
- Não adicionar dependências (sem `react-to-print` — `window.print()` é suficiente).
