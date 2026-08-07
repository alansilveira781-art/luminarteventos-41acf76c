
-- 1. comercial_cards: delete só dono ou admin
DROP POLICY IF EXISTS comercial_cards_delete ON public.comercial_cards;
CREATE POLICY comercial_cards_delete ON public.comercial_cards
FOR DELETE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial') OR created_by = auth.uid());

-- 2. comercial_catalogo: escrita destrutiva só admin
DROP POLICY IF EXISTS "comercial_catalogo write" ON public.comercial_catalogo;
DROP POLICY IF EXISTS "comercial_catalogo read" ON public.comercial_catalogo;
DROP POLICY IF EXISTS comercial_catalogo_update ON public.comercial_catalogo;
DROP POLICY IF EXISTS comercial_catalogo_delete ON public.comercial_catalogo;
CREATE POLICY comercial_catalogo_update ON public.comercial_catalogo
FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'))
WITH CHECK (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'));
CREATE POLICY comercial_catalogo_delete ON public.comercial_catalogo
FOR DELETE TO authenticated
USING (is_admin(auth.uid()) OR is_module_admin(auth.uid(), 'comercial'));

-- 3. diarista_lancadores: leitura só admin de diárias ou o próprio usuário
DROP POLICY IF EXISTS "Autenticados leem lancadores" ON public.diarista_lancadores;
CREATE POLICY "Lancadores: leitura restrita" ON public.diarista_lancadores
FOR SELECT TO authenticated
USING (is_diaria_admin(auth.uid()) OR user_id = auth.uid());

-- 4. eventos_terceirizados: leitura escopada ao módulo eventos
DROP POLICY IF EXISTS "Terceirizados: leitura autenticada" ON public.eventos_terceirizados;
CREATE POLICY "Terceirizados: leitura com acesso a eventos" ON public.eventos_terceirizados
FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR has_module_access(auth.uid(), 'eventos'));

-- 5. op_ordens: registrar criador e limitar update
CREATE OR REPLACE FUNCTION public.op_ordens_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS op_ordens_set_created_by_trg ON public.op_ordens;
CREATE TRIGGER op_ordens_set_created_by_trg
BEFORE INSERT ON public.op_ordens
FOR EACH ROW EXECUTE FUNCTION public.op_ordens_set_created_by();

DROP POLICY IF EXISTS op_ordens_insert ON public.op_ordens;
CREATE POLICY op_ordens_insert ON public.op_ordens
FOR INSERT TO authenticated
WITH CHECK (
  has_module_access(auth.uid(), 'operacao')
  AND (created_by IS NULL OR created_by = auth.uid())
);

DROP POLICY IF EXISTS op_ordens_update ON public.op_ordens;
CREATE POLICY op_ordens_update ON public.op_ordens
FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'operacao')
  OR (has_module_access(auth.uid(), 'operacao') AND (
        created_by = auth.uid()
        OR responsavel_id = auth.uid()
        OR (created_by IS NULL AND responsavel_id IS NULL)
     ))
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_module_admin(auth.uid(), 'operacao')
  OR has_module_access(auth.uid(), 'operacao')
);
