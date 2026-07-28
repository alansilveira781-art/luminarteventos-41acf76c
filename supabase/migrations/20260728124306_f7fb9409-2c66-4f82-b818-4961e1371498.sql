-- 1) admin_empresas: restringir leitura
DROP POLICY IF EXISTS "admin_empresas leitura autenticada" ON public.admin_empresas;
CREATE POLICY "admin_empresas leitura restrita"
ON public.admin_empresas
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'admin')
  OR public.has_module_access(auth.uid(), 'rh')
  OR public.has_module_access(auth.uid(), 'juridico')
  OR public.has_module_access(auth.uid(), 'contabil')
);

-- 2) comercial_vendas_sync: created_by obrigatório
UPDATE public.comercial_vendas_sync
SET created_by = (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1)
WHERE created_by IS NULL;

DELETE FROM public.comercial_vendas_sync WHERE created_by IS NULL;

ALTER TABLE public.comercial_vendas_sync
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.comercial_vendas_sync
  ALTER COLUMN created_by SET NOT NULL;