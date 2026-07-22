## Objetivo
Remover a duplicata da venda "ABERTURA COCAL / BEACH PARK" com `data_registro = 26/06/2026`, mantendo a linha correta (registro 01/07/2026).

## Ação
- Excluir o registro `bc0c48dc-b2d4-4f3d-aa35-b38b4c2d3f2a` da tabela `comercial_vendas` (criado em 02/07 via sync antigo da planilha).
- Manter `7e50a925-588f-461e-b39c-163c1dabd152` (data_registro 01/07/2026, criado em 13/07).

Após a exclusão, o Detalhamento de Vendas passará a mostrar apenas a linha com 01/07/2026.

## Observação
Isto não altera o comportamento futuro: se a planilha for reenviada com a mesma linha "26/06", ela voltará a ser inserida. Caso queira prevenir novas duplicatas, me avise depois para adicionar dedupe no upload/insert (ou índice único no banco).
