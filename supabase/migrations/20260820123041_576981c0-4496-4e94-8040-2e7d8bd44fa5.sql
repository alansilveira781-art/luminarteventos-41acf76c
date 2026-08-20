ALTER TABLE public.admin_empresas
  ADD COLUMN IF NOT EXISTS representante_email text,
  ADD COLUMN IF NOT EXISTS representante_telefone text;