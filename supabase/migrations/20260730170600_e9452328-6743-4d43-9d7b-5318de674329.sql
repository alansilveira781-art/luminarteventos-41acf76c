ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS solicitante_email text;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS solicitante_email text;

CREATE INDEX IF NOT EXISTS idx_compras_solicitante_email ON public.compras (lower(solicitante_email));
CREATE INDEX IF NOT EXISTS idx_demandas_solicitante_email ON public.demandas (lower(solicitante_email));

-- Backfill 1: e-mail embutido nas observações do formulário público
UPDATE public.compras
   SET solicitante_email = lower((regexp_match(observacoes, 'email:\s*([^\s·)\n]+@[^\s·)\n]+)'))[1])
 WHERE solicitante_email IS NULL
   AND observacoes ~ 'email:\s*[^\s·)\n]+@';

UPDATE public.demandas
   SET solicitante_email = lower((regexp_match(observacoes, 'email:\s*([^\s·)\n]+@[^\s·)\n]+)'))[1])
 WHERE solicitante_email IS NULL
   AND observacoes ~ 'email:\s*[^\s·)\n]+@';

-- Backfill 2: e-mail do perfil de quem criou / é solicitante
UPDATE public.compras c
   SET solicitante_email = lower(p.email)
  FROM public.profiles p
 WHERE c.solicitante_email IS NULL
   AND p.email IS NOT NULL
   AND p.id = COALESCE(c.solicitante_id, c.created_by);

UPDATE public.demandas d
   SET solicitante_email = lower(p.email)
  FROM public.profiles p
 WHERE d.solicitante_email IS NULL
   AND p.email IS NOT NULL
   AND p.id = COALESCE(d.solicitante_id, d.created_by);

-- Backfill 3: vincular solicitante_id quando o e-mail bate com um perfil
UPDATE public.compras c
   SET solicitante_id = p.id
  FROM public.profiles p
 WHERE c.solicitante_id IS NULL
   AND c.solicitante_email IS NOT NULL
   AND lower(p.email) = lower(c.solicitante_email);

UPDATE public.demandas d
   SET solicitante_id = p.id
  FROM public.profiles p
 WHERE d.solicitante_id IS NULL
   AND d.solicitante_email IS NOT NULL
   AND lower(p.email) = lower(d.solicitante_email);

DROP POLICY IF EXISTS compras_select_owner ON public.compras;
CREATE POLICY compras_select_owner ON public.compras
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL AND lower(solicitante) = lower(auth.jwt() ->> 'email'))
  OR (solicitante_email IS NOT NULL AND lower(solicitante_email) = lower(auth.jwt() ->> 'email'))
);

DROP POLICY IF EXISTS demandas_select_owner ON public.demandas;
CREATE POLICY demandas_select_owner ON public.demandas
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL AND lower(solicitante) = lower(auth.jwt() ->> 'email'))
  OR (solicitante_email IS NOT NULL AND lower(solicitante_email) = lower(auth.jwt() ->> 'email'))
);