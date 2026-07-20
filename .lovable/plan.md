## Causa raiz

Confirmei via consulta ao banco: a Luciene tem apenas o módulo **estoque**, e as policies RLS da tabela `demandas` (e `demanda_anexos`) não incluem esse módulo.

Policies atuais em `demandas` (SELECT):
- `financeiro module access` — só financeiro
- `financeiro_op pode atualizar` — só UPDATE, financeiro_op
- `patrimonio read demandas imobilizado` — só patrimônio, tipo imobilizado
- `demandas_select_owner` — dono/solicitante

Não existe policy que permita ao módulo **estoque** ler `demandas`. Resultado: a query em `/estoque/a-receber` retorna vazio para ela, mesmo os cards estando em `status='a_receber'`. `demanda_itens` já permite estoque, mas o JOIN inicial em `demandas` já vem vazio, então nada é exibido.

Também falta permissão de **UPDATE** em `demandas` (para o botão "Validar recebimento" mover para `finalizado`) e **SELECT** em `demanda_anexos` para visualizar anexos.

## Correção

Adicionar policies RLS restritas ao fluxo de estoque (apenas demandas cujo `tipo_demanda` está entre os que geram entrada em estoque: `fardamento`, `material_limpeza`, `material_escritorio`, `reposicao_estoque`):

1. **SELECT em `demandas`** para usuários com módulo estoque, quando `tipo_demanda IN (...)` e `status IN ('a_receber','finalizado')`.
2. **UPDATE em `demandas`** para usuários com módulo estoque, mesma restrição de tipo (permite marcar como finalizado após recebimento).
3. **SELECT em `demanda_anexos`** para usuários com módulo estoque, via EXISTS na demanda pai com o mesmo filtro de tipo.

Nenhuma alteração de UI é necessária — o código já busca corretamente; era apenas RLS bloqueando.

## Verificação após aplicar

- Luciene abre `/estoque/a-receber` → cards de demandas de fardamento/limpeza/escritório/reposição aparecem.
- Botão "Validar recebimento" finaliza a demanda sem erro de permissão.
- Anexos abrem normalmente no dialog.
