# Relatório de Vendas: coluna Comissão cortada no PDF

## O que está acontecendo

A tabela do PDF é mais larga que a folha. Somando as larguras fixas das 11 colunas dá 299 mm, mas o A4 paisagem tem 297 mm e ainda perde 12 mm de margem de cada lado — sobram 273 mm. Como as colunas são fixas, a última coluna (Comissão) fica para fora da página e aparece cortada.

## Correção

Em `src/lib/comercial/vendas-relatorio.ts`, reajustar as larguras da tabela principal para caber nos 273 mm úteis, reduzindo as colunas de texto longo (Evento, Local/Cidade, Consultor, Cerimonial) e mantendo as colunas de valores legíveis:

- Data 18 · Evento 44 · Local/Cidade 38 · Empresa 18 · Consultor 24 · Cerimonial 24 · Proposta 21 · Desconto 19 · Valor final 22 · BV 19 · Comissão 22 (total 269 mm, com folga)
- Textos longos continuam quebrando em várias linhas (`overflow: "linebreak"`), então nada é truncado.
- Também usar `tableWidth: "auto"`/checagem de largura para que qualquer ajuste futuro não estoure a página.

Sem mudanças de dados, banco ou no CSV — apenas layout do PDF.
