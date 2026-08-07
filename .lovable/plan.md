# Erro ao migrar compra para despesa (anexos com acento/espaço)

## Causa confirmada

Na migração de Compra → Despesa, o arquivo é regravado usando o nome original do anexo
(`Orçamento Diproseg Dia 15.jpg`). O armazenamento não aceita acentos/espaços no caminho,
então retorna "Invalid key" e a migração para. Nos demais pontos do sistema (upload no card
de Compra e de Despesa) o nome já é higienizado antes de subir — só a migração ficou de fora.

## Correção

- Na migração, higienizar o nome do arquivo no caminho de destino (acentos, espaços e
  caracteres especiais viram `_`), mantendo o nome original visível na lista de anexos.
- Se ainda assim algum anexo falhar, mostrar o nome do arquivo e o motivo, e não excluir a
  compra original (comportamento já previsto).

## Detalhes técnicos

Arquivo: `src/routes/compras.index.tsx` (linha ~796, `MigrarCompraDialog`).
Trocar `demandas/${novaDem.id}/${Date.now()}-${a.nome}` por um `safeName` gerado com
`a.nome.replace(/[^a-zA-Z0-9._-]/g, "_")`, igual ao já usado em `CompraDialog.tsx` e
`DemandaDialog.tsx`. O campo `nome` gravado em `demanda_anexos` continua sendo o original.

Sem mudanças de banco de dados e sem impacto em outros módulos.
