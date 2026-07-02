Corrigir o bug de fuso horário em `src/components/PeriodoFilter.tsx` na função `filterByPeriodo`, que exclui o primeiro dia de qualquer intervalo filtrado em fusos UTC-negativos (ex.: Fortaleza UTC-3).

**O que será feito**
1. Adicionar helpers internos `toLocalYmd` e `rowYmd` no arquivo `src/components/PeriodoFilter.tsx`.
2. Substituir a implementação atual de `filterByPeriodo` (que compara timestamps em ms) por uma comparação de strings `YYYY-MM-DD` no fuso local, eliminando a conversão UTC que causava o deslocamento de dia.

**Arquivo alterado**
- `src/components/PeriodoFilter.tsx` (somente a função `filterByPeriodo` e os helpers adicionados)

**Não será alterado**
- `periodoFromPreset`, `periodoDoMes`, presets, assinatura de `filterByPeriodo`, páginas consumidoras ou outros módulos.

**Verificação**
- Rodar `bunx tsc --noEmit -p tsconfig.json` para garantir que a tipagem permanece válida.
- Validar visualmente na página `/comercial/vendas` que filtrar por "Este mês" (ou outro preset) passa a incluir o dia 01 do intervalo.