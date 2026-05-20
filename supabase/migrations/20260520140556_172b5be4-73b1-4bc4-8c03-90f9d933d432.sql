
-- 1) Fix notificacoes INSERT bypass (WITH CHECK true)
DROP POLICY IF EXISTS "notificacoes self" ON public.notificacoes;

CREATE POLICY "notificacoes select own"
ON public.notificacoes FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "notificacoes insert own"
ON public.notificacoes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "notificacoes update own"
ON public.notificacoes FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "notificacoes delete own"
ON public.notificacoes FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2) Restrict OAuth credential access to global admins only.
--    The is_module_admin('financeiro') helper grants access to all
--    financeiro members by design (per product preference); credentials
--    are too sensitive for that, so we lock to global admins.
DROP POLICY IF EXISTS "financeiro admin manage" ON public.conta_azul_credentials;

CREATE POLICY "conta_azul_credentials admin only"
ON public.conta_azul_credentials FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3) Add missing UPDATE policy on demanda-anexos storage bucket
CREATE POLICY "demanda anexos update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'demanda-anexos')
WITH CHECK (bucket_id = 'demanda-anexos');
