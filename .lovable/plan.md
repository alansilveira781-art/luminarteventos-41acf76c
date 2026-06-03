## Investigar divergências do DRE

Você confirmou que `IN` (Investimentos) está correto e que todos os outros prefixos batem com o que já está em `src/lib/conta-azul/dre.ts`. Então estruturalmente o código já está alinhado com sua especificação.

Para corrigir os dados que não estão batendo, preciso saber **onde** está o erro.

### Pergunta

Me diga, no DRE atual da tela, **uma linha específica** com valor errado — por exemplo:

- "Receita Bruta está R$ X mas deveria ser R$ Y"
- "Despesas Tributárias está zerada"
- "Aparece muita coisa em (?) Sem classificação"
- "Resultado Financeiro tem sinal trocado"

Com isso eu consigo:
1. Rodar uma query no banco para ver quais contas do plano estão caindo (ou não) na linha,
2. Identificar se é problema de prefixo, de override por nome, de sinal, de período (realizado vs projetado), ou de transferência sendo classificada como receita/despesa,
3. Propor o ajuste pontual em `dre.ts`.

Se preferir, me mande um print/lista das linhas com valores errados que aparecem hoje na tela e eu investigo a partir daí.
