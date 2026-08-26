DROP POLICY IF EXISTS comercial_produtores_select ON public.comercial_produtores;
DROP POLICY IF EXISTS comercial_produtores_insert ON public.comercial_produtores;
DROP POLICY IF EXISTS comercial_produtores_update ON public.comercial_produtores;
DROP POLICY IF EXISTS comercial_produtores_delete ON public.comercial_produtores;

CREATE POLICY comercial_produtores_select ON public.comercial_produtores
FOR SELECT TO authenticated
USING (has_module_access(auth.uid(), 'comercial') OR has_module_access(auth.uid(), 'eventos'));

CREATE POLICY comercial_produtores_insert ON public.comercial_produtores
FOR INSERT TO authenticated
WITH CHECK (has_module_access(auth.uid(), 'comercial') OR has_module_access(auth.uid(), 'eventos'));

CREATE POLICY comercial_produtores_update ON public.comercial_produtores
FOR UPDATE TO authenticated
USING (has_module_access(auth.uid(), 'comercial') OR has_module_access(auth.uid(), 'eventos'))
WITH CHECK (has_module_access(auth.uid(), 'comercial') OR has_module_access(auth.uid(), 'eventos'));

CREATE POLICY comercial_produtores_delete ON public.comercial_produtores
FOR DELETE TO authenticated
USING (has_module_access(auth.uid(), 'comercial') OR has_module_access(auth.uid(), 'eventos'));