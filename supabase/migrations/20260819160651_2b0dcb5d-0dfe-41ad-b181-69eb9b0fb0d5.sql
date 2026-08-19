ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS clicksign_document_key text,
  ADD COLUMN IF NOT EXISTS clicksign_status text NOT NULL DEFAULT 'nao_enviado',
  ADD COLUMN IF NOT EXISTS clicksign_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS clicksign_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS clicksign_erro text;

ALTER TABLE public.juridico_anexos DROP CONSTRAINT IF EXISTS juridico_anexos_tipo_check;
ALTER TABLE public.juridico_anexos ADD CONSTRAINT juridico_anexos_tipo_check
  CHECK (tipo = ANY (ARRAY['proposta'::text,'contrato'::text,'contrato_assinado'::text,'outro'::text]));

CREATE TABLE IF NOT EXISTS public.juridico_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.juridico_contratos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  documento text,
  papel text NOT NULL DEFAULT 'cliente',
  sign_as text,
  signer_key text,
  request_signature_key text,
  status text NOT NULL DEFAULT 'pendente',
  assinado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS juridico_assinaturas_contrato_id_idx ON public.juridico_assinaturas(contrato_id);
CREATE INDEX IF NOT EXISTS juridico_assinaturas_request_key_idx ON public.juridico_assinaturas(request_signature_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.juridico_assinaturas TO authenticated;
GRANT ALL ON public.juridico_assinaturas TO service_role;

ALTER TABLE public.juridico_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "juridico_assinaturas module access" ON public.juridico_assinaturas;
CREATE POLICY "juridico_assinaturas module access" ON public.juridico_assinaturas
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'juridico'))
  WITH CHECK (has_module_access(auth.uid(), 'juridico'));

DROP TRIGGER IF EXISTS juridico_assinaturas_set_updated_at ON public.juridico_assinaturas;
CREATE TRIGGER juridico_assinaturas_set_updated_at BEFORE UPDATE ON public.juridico_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();