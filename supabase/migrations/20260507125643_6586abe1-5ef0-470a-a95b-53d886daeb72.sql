
CREATE SEQUENCE IF NOT EXISTS public.compras_numero_seq;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS numero integer;
UPDATE public.compras SET numero = nextval('public.compras_numero_seq') WHERE numero IS NULL;
ALTER TABLE public.compras ALTER COLUMN numero SET DEFAULT nextval('public.compras_numero_seq');
SELECT setval('public.compras_numero_seq', COALESCE((SELECT MAX(numero) FROM public.compras), 1));
