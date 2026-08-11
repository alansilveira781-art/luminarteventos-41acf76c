ALTER TABLE public.compra_anexos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'anexo';
ALTER TABLE public.demanda_anexos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'anexo';

ALTER TABLE public.compra_anexos DROP CONSTRAINT IF EXISTS compra_anexos_tipo_check;
ALTER TABLE public.compra_anexos ADD CONSTRAINT compra_anexos_tipo_check CHECK (tipo IN ('anexo','comprovante'));
ALTER TABLE public.demanda_anexos DROP CONSTRAINT IF EXISTS demanda_anexos_tipo_check;
ALTER TABLE public.demanda_anexos ADD CONSTRAINT demanda_anexos_tipo_check CHECK (tipo IN ('anexo','comprovante'));

DROP POLICY IF EXISTS "demanda_anexos select owner" ON public.demanda_anexos;
CREATE POLICY "demanda_anexos select owner" ON public.demanda_anexos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_anexos.demanda_id
      AND (
        d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
        OR (d.solicitante_email IS NOT NULL AND lower(d.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);

DROP POLICY IF EXISTS "demanda anexos read owner" ON storage.objects;
CREATE POLICY "demanda anexos read owner" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'demanda-anexos' AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = public.storage_folder_uuid(objects.name)
      AND (
        d.created_by = auth.uid()
        OR d.solicitante_id = auth.uid()
        OR (d.solicitante_email IS NOT NULL AND lower(d.solicitante_email) = lower(auth.jwt() ->> 'email'))
      )
  )
);