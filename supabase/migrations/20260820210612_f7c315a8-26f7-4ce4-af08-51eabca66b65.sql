ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS dropbox_path text,
  ADD COLUMN IF NOT EXISTS dropbox_url text;