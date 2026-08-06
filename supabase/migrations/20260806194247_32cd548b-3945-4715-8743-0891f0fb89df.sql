ALTER TABLE public.admin_empresas
  ADD COLUMN IF NOT EXISTS representante_nome text,
  ADD COLUMN IF NOT EXISTS representante_documento text;

ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS testemunhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resp_legal2_nome text,
  ADD COLUMN IF NOT EXISTS resp_legal2_documento text,
  ADD COLUMN IF NOT EXISTS resp_legal2_email text,
  ADD COLUMN IF NOT EXISTS resp_legal2_telefone text,
  ADD COLUMN IF NOT EXISTS resp_legal2_cep text,
  ADD COLUMN IF NOT EXISTS resp_legal2_logradouro text,
  ADD COLUMN IF NOT EXISTS resp_legal2_numero text,
  ADD COLUMN IF NOT EXISTS resp_legal2_complemento text,
  ADD COLUMN IF NOT EXISTS resp_legal2_bairro text,
  ADD COLUMN IF NOT EXISTS resp_legal2_cidade text,
  ADD COLUMN IF NOT EXISTS resp_legal2_uf text;