## Objetivo
Na aba **Apuração de impostos** (`src/routes/contabil.apuracoes.tsx`), substituir o botão "Imprimir rascunho" por um botão **Exportar** com um menu de duas opções: **PDF** e **Excel**.

## Mudanças

Arquivo único: `src/routes/contabil.apuracoes.tsx`

1. **Renomear** a função `imprimirRascunho` para `exportarPDF` (mantendo exatamente o mesmo HTML já usado — o navegador imprime como PDF via `window.print()`). Nada muda no conteúdo do relatório.

2. **Adicionar** `exportarExcel` usando a lib `xlsx` (já disponível no projeto — verificar; se não, adicionar `bun add xlsx`). Gera um `.xlsx` com:
   - Cabeçalho: Empresa, Referência (mês/ano), Regime, Gerado em.
   - Planilha "Lançamentos" com as mesmas colunas do PDF (Data, Nº NF, Evento, Valor, Banco) e linha de Total (Faturamento).
   - Planilha "Impostos" com Imposto/Valor + Total.
   - Nome do arquivo: `apuracao-<empresa>-<mes>-<ano>.xlsx`.

3. **Substituir** o `<Button>` "Imprimir rascunho" por um `DropdownMenu` (shadcn, já em uso no projeto) com trigger **Exportar** (ícone `Download`) e dois `DropdownMenuItem`: **PDF** e **Excel**, que chamam as funções acima. Manter o mesmo `variant="outline"` e posição.

4. Substituir o import do ícone `Printer` por `Download` (remover Printer se não for mais usado em outro lugar do arquivo).

## Fora de escopo
- Nenhuma mudança em cálculos, dados ou outras abas.
- Nenhuma mudança de layout/estilo além do botão.
