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