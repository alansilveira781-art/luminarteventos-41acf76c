## Imprimir rascunho de apuração

Adicionar botão "Imprimir rascunho" no cabeçalho de `src/routes/contabil.apuracoes.tsx`, ao lado de "Registrar apuração", que gera um relatório para impressão baseado nos filtros atuais (Empresa, Mês de referência, Regime).

### Conteúdo do relatório
- Cabeçalho: título "Rascunho de Apuração", Empresa, Mês/Ano, Regime (Caixa/Competência), data de geração.
- Tabela com colunas:
  - **Data** (data_recebimento no caixa; data_emissao na competência)
  - **Nº NF** (com fallback via `notasMap` já usado na tela)
  - **Evento** (mesmo fallback já em uso)
  - **Valor** (valor_recebido no caixa; valor_bruto na competência)
  - **Banco** (do recebimento; vazio "—" na competência)
- Linha de total: Faturamento base.
- Rodapé opcional com totais de impostos já calculados na tela (PIS/COFINS/IRPJ/CSLL) para dar contexto do rascunho.

### Implementação
- Botão com ícone `Printer` (lucide-react) que chama uma função `imprimirRascunho()`.
- A função abre `window.open("", "_blank")`, injeta um HTML estático (estilos inline básicos, tabela simples, `@media print` para esconder margens do browser), e chama `window.print()` após `onload`.
- Reaproveita os dados já carregados nas queries (`recebimentos`, `notasEmitidas`, `notasMap`) — sem novas queries.
- Nada muda no fluxo existente de "Registrar apuração".

### Arquivos
- `src/routes/contabil.apuracoes.tsx` — adicionar botão e função `imprimirRascunho()`.