CREATE TABLE public.solicitacoes_publicas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text,
  titulo text,
  solicitante_nome text,
  solicitante_email text,
  ip_hash text,
  resultado text NOT NULL,
  erro text,
  card_id uuid,
  card_numero integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.solicitacoes_publicas_log TO authenticated;
GRANT ALL ON public.solicitacoes_publicas_log TO service_role;

ALTER TABLE public.solicitacoes_publicas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solicitacoes_log_select_compras"
ON public.solicitacoes_publicas_log
FOR SELECT
TO authenticated
USING (public.has_module_access(auth.uid(), 'compras'));

CREATE INDEX idx_solicitacoes_publicas_log_created_at
ON public.solicitacoes_publicas_log (created_at DESC);