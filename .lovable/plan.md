Criar uma migration SQL para adicionar políticas de leitura (SELECT) nas tabelas do estoque para usuários do módulo Compras, permitindo que o AlertaEstoqueCard do dashboard de Compras exiba os alertas de estoque.

Alterações

- Adicionar a migration SQL com três políticas de SELECT:
  - public.itens → "compras read itens"
  - public.movimentacoes → "compras read movimentacoes"
  - public.movimentacao_itens → "compras read movimentacao_itens"
- Cada política verifica se o usuário autenticado tem acesso ao módulo "compras" via public.has_module_access(auth.uid(), 'compras').
- As políticas existentes do módulo estoque não serão alteradas nem removidas.
- Não serão adicionadas políticas de INSERT, UPDATE ou DELETE para compras nessas tabelas.
- Nenhum arquivo .tsx será alterado.

Detalhes técnicos

- Usar a ferramenta supabase--migration para executar a migration no banco.
- SQL a ser executado:

```sql
-- Permite que usuários do módulo "compras" leiam itens, movimentacoes e
-- movimentacao_itens para exibir os alertas de estoque no dashboard de Compras.
-- As políticas de escrita continuam restritas ao módulo "estoque".

CREATE POLICY "compras read itens"
  ON public.itens
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras'));

CREATE POLICY "compras read movimentacoes"
  ON public.movimentacoes
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras'));

CREATE POLICY "compras read movimentacao_itens"
  ON public.movimentacao_itens
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'compras'));
```

Critérios de aceite

- Usuários com acesso ao módulo Compras (e sem acesso ao módulo Estoque) passam a visualizar os alertas de estoque no dashboard de Compras.
- Usuários do módulo Estoque continuam com acesso inalterado.
- Não há mudanças de permissão de escrita para compras nas tabelas de estoque.