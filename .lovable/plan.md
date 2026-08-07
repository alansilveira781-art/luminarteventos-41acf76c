# Erro ao migrar card de Compra para Despesa (anexo bloqueado)

## Causa confirmada

Na migração, o anexo é enviado para o armazenamento de despesas dentro de uma pasta
`demandas/<id>/...`. A regra de segurança do armazenamento de despesas espera que a pasta
raiz seja **o próprio id da despesa** (`<id>/arquivo`), como já acontece no card de Despesa.
Como o caminho começa com "demandas", a regra não reconhece o dono do arquivo e recusa o
envio com "new row violates row-level security policy".

## Correção

- Na migração, gravar o anexo em `<id_da_despesa>/<timestamp>_<nome_higienizado>`,
  exatamente o mesmo padrão já usado ao anexar direto no card de Despesa.
- Nome original do arquivo continua sendo exibido na lista de anexos.
- Comportamento em caso de falha permanece: mostra o arquivo e o motivo e não apaga a compra.

## Detalhes técnicos

Arquivo: `src/routes/compras.index.tsx` (~linha 799, `MigrarCompraDialog`).
Trocar `demandas/${novaDem.id}/${Date.now()}-${safeName}` por
`${novaDem.id}/${Date.now()}_${safeName}`, alinhando com `DemandaDialog.tsx`.
A policy de INSERT usa `storage_folder_uuid(name)`, que lê apenas o primeiro segmento do
caminho e exige que seja um UUID de despesa.

Sem mudanças de banco de dados.
