UPDATE public.compras
SET tipo_compra = 'mercadoria'
WHERE status = 'a_receber'
  AND (tipo_compra IS NULL OR tipo_compra = '');