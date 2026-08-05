-- 1) comercial_proposta_seq: garantir que só a função SECURITY DEFINER escreve
REVOKE INSERT, UPDATE, DELETE ON public.comercial_proposta_seq FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comercial_proposta_seq FROM anon;
GRANT SELECT ON public.comercial_proposta_seq TO authenticated;
GRANT ALL ON public.comercial_proposta_seq TO service_role;

-- 2) compra_anexos: escopo de leitura alinhado à posse (tabela + storage)
DROP POLICY IF EXISTS "compra_anexos_select_modulo" ON public.compra_anexos;
CREATE POLICY "compra_anexos select owner" ON public.compra_anexos
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'compras')
  OR is_module_admin(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (
        c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);

DROP POLICY IF EXISTS "compra-anexos read" ON storage.objects;
CREATE POLICY "compra-anexos read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'compra-anexos'
  AND EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = public.storage_folder_uuid(objects.name)
      AND (
        is_admin(auth.uid())
        OR is_module_admin(auth.uid(), 'compras')
        OR is_module_admin(auth.uid(), 'estoque')
        OR c.created_by = auth.uid()
        OR c.responsavel_id = auth.uid()
        OR c.solicitante_id = auth.uid()
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
        OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);

-- 3) Conta Azul: separar leitura (módulo financeiro) de escrita (admins/serviço)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ca_contas_pagar','ca_contas_receber','ca_extrato','ca_plano_contas','ca_centros_custo','ca_sync_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'financeiro module access', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (has_module_access(auth.uid(), 'financeiro'))$f$,
      t || '_select_financeiro', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'))$f$,
      t || '_insert_admin', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro')) WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'))$f$,
      t || '_update_admin', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'financeiro'))$f$,
      t || '_delete_admin', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;