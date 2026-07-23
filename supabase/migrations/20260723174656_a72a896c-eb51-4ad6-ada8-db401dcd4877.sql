
-- Adiciona tipo (contrato/aditivo) e numeração sequencial por tipo em juridico_contratos
ALTER TABLE public.juridico_contratos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'contrato',
  ADD COLUMN IF NOT EXISTS numero integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'juridico_contratos_tipo_check'
  ) THEN
    ALTER TABLE public.juridico_contratos
      ADD CONSTRAINT juridico_contratos_tipo_check
      CHECK (tipo IN ('contrato','aditivo'));
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.juridico_contrato_numero_seq;
CREATE SEQUENCE IF NOT EXISTS public.juridico_aditivo_numero_seq;

-- Backfill: numera contratos existentes por ordem de criação
WITH ordenados AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tipo ORDER BY created_at) AS n
  FROM public.juridico_contratos WHERE numero IS NULL
)
UPDATE public.juridico_contratos c
   SET numero = o.n
  FROM ordenados o
 WHERE c.id = o.id;

-- Ajusta sequências para acima do maior valor existente
SELECT setval('public.juridico_contrato_numero_seq',
  GREATEST(COALESCE((SELECT MAX(numero) FROM public.juridico_contratos WHERE tipo='contrato'), 0), 1),
  true);
SELECT setval('public.juridico_aditivo_numero_seq',
  GREATEST(COALESCE((SELECT MAX(numero) FROM public.juridico_contratos WHERE tipo='aditivo'), 0), 1),
  true);

-- Trigger para atribuir número automaticamente
CREATE OR REPLACE FUNCTION public.juridico_contratos_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NULL THEN NEW.tipo := 'contrato'; END IF;
  IF NEW.numero IS NULL THEN
    IF NEW.tipo = 'aditivo' THEN
      NEW.numero := nextval('public.juridico_aditivo_numero_seq');
    ELSE
      NEW.numero := nextval('public.juridico_contrato_numero_seq');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS juridico_contratos_set_numero_trg ON public.juridico_contratos;
CREATE TRIGGER juridico_contratos_set_numero_trg
BEFORE INSERT ON public.juridico_contratos
FOR EACH ROW EXECUTE FUNCTION public.juridico_contratos_set_numero();

CREATE UNIQUE INDEX IF NOT EXISTS juridico_contratos_tipo_numero_uidx
  ON public.juridico_contratos (tipo, numero);
