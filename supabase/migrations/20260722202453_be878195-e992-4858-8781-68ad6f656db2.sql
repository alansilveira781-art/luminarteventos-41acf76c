ALTER TABLE public.comercial_vendedores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS comercial_vendedores_user_id_key
  ON public.comercial_vendedores(user_id) WHERE user_id IS NOT NULL;