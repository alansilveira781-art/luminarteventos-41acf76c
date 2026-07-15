
-- comercial_classificacoes: restrict SELECT to users with comercial module access
DROP POLICY IF EXISTS "cc_select" ON public.comercial_classificacoes;
CREATE POLICY "cc_select_module" ON public.comercial_classificacoes
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

-- contabil_tomadores: restrict SELECT to users with contabil module access
DROP POLICY IF EXISTS "Autenticados leem tomadores" ON public.contabil_tomadores;
CREATE POLICY "Leem tomadores com acesso contabil" ON public.contabil_tomadores
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'contabil'));

-- modulos: users only see modules they have access to (admins see all via has_module_access)
DROP POLICY IF EXISTS "modulos read auth" ON public.modulos;
CREATE POLICY "modulos read scoped" ON public.modulos
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), slug));
