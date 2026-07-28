DROP POLICY IF EXISTS "juridico_contratos solicitante insert" ON public.juridico_contratos;
DROP POLICY IF EXISTS "juridico_contratos solicitante read own" ON public.juridico_contratos;
DROP TABLE IF EXISTS public.juridico_solicitantes;
DROP FUNCTION IF EXISTS public.pode_solicitar_contrato(uuid);