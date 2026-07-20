CREATE INDEX IF NOT EXISTS idx_ca_rateios_tipo_lanc_valor
  ON public.ca_lancamento_rateios (tipo, lancamento_external_id, valor);

CREATE OR REPLACE FUNCTION public.ca_listar_rateios_suspeitos(_tipo text, _limite integer DEFAULT 40)
RETURNS TABLE(external_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH suspeitos AS (
    SELECT r.lancamento_external_id
    FROM public.ca_lancamento_rateios r
    WHERE r.tipo = _tipo
    GROUP BY r.lancamento_external_id
    HAVING count(*) >= 2
       AND count(DISTINCT r.valor) = 1
  )
  SELECT s.lancamento_external_id::text AS external_id
  FROM suspeitos s
  LEFT JOIN public.ca_contas_pagar p
    ON _tipo = 'pagar' AND p.external_id = s.lancamento_external_id
  LEFT JOIN public.ca_contas_receber c
    ON _tipo = 'receber' AND c.external_id = s.lancamento_external_id
  ORDER BY
    COALESCE(p.detalhe_synced_at, c.detalhe_synced_at) ASC NULLS FIRST,
    s.lancamento_external_id
  LIMIT LEAST(GREATEST(COALESCE(_limite, 40), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.ca_listar_rateios_suspeitos(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ca_listar_rateios_suspeitos(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.ca_listar_rateios_suspeitos(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ca_listar_rateios_suspeitos(text, integer) TO service_role;