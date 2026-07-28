ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS resp_legal_nome text,
  ADD COLUMN IF NOT EXISTS resp_legal_documento text,
  ADD COLUMN IF NOT EXISTS resp_legal_email text,
  ADD COLUMN IF NOT EXISTS resp_legal_telefone text;