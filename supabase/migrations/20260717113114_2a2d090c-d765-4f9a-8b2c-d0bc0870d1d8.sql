ALTER TABLE public.comercial_vendedores
  ADD COLUMN IF NOT EXISTS tipo_comissao text NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS gatilho_meta numeric,
  ADD COLUMN IF NOT EXISTS gatilho_valor numeric;

ALTER TABLE public.comercial_vendedores
  DROP CONSTRAINT IF EXISTS comercial_vendedores_tipo_comissao_chk;

ALTER TABLE public.comercial_vendedores
  ADD CONSTRAINT comercial_vendedores_tipo_comissao_chk
  CHECK (tipo_comissao IN ('percentual','gatilho'));