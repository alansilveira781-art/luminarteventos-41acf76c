ALTER TABLE public.rh_colaboradores ADD COLUMN IF NOT EXISTS apelido text;
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_documento_key UNIQUE (documento);