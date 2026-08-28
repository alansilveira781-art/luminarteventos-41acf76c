# Conferência Egestor: saldos decimais e diferenças com dízimas

## O que está acontecendo

Dois problemas na leitura da planilha do Egestor:

1. **-0,5 vira -5.** A leitura do saldo trata o ponto como separador de milhar. Quando a célula chega com ponto decimal ("-0.5"), o ponto é removido e o valor vira -5 (foi o caso do TECIDO CREPE AZUL BEBE). Existem ainda regras antigas de "dividir por 10 bilhões" para números muito grandes, que podem distorcer outros saldos.
2. **Diferenças tipo +0.29999999999.** A diferença é calculada em ponto flutuante e mostrada sem arredondamento, gerando dízimas na tela e na exportação.

## O que muda

- Leitura do saldo passa a interpretar corretamente os dois formatos: `-0,5` (vírgula decimal) e `-0.5` (ponto decimal), inclusive com milhar (`1.234,56` e `1,234.56`). O ponto só é tratado como milhar quando o padrão realmente indica isso (grupos de 3 dígitos).
- As heurísticas de divisão por 1e10 são removidas, para não alterar valores legítimos.
- Toda diferença é arredondada para 3 casas decimais, eliminando as dízimas na coluna Diferença, no ajuste, no tooltip e na exportação .xlsx. Diferenças residuais menores que 0,001 passam a contar como "OK" em vez de "Divergente".

Depois do ajuste, o TECIDO CREPE AZUL BEBE aparece com Saldo Egestor -0,5 (em vez de -5) e os itens de cabo mostram diferenças limpas (+0,26 / +0,3 / -0,4 etc.).

## Detalhes técnicos

Arquivo: `src/components/estoque/ConferenciaEgestorDialog.tsx`

- Reescrever `parseSaldoEgestor`: detectar o separador decimal pelo último `,` ou `.` presente, removendo apenas os separadores de milhar; sem escalonamentos por magnitude.
- Adicionar `arred(n)` (3 casas) e aplicar em `dif` na montagem de `LinhaConferencia`, no `ajustarLinha` (hoje arredonda a 2 casas) e na linha de exportação.
- Classificação: `status = Math.abs(dif) < 0.001 ? "ok" : "divergente"`.
