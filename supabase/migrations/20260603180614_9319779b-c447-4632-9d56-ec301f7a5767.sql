
-- ca_sync_state
CREATE TABLE public.ca_sync_state (
  recurso TEXT PRIMARY KEY,
  last_synced_from DATE,
  last_synced_to DATE,
  last_run_at TIMESTAMPTZ,
  qtd_total BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ca_sync_state TO authenticated;
GRANT ALL ON public.ca_sync_state TO service_role;
ALTER TABLE public.ca_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_sync_state read for financeiro" ON public.ca_sync_state
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'financeiro'));

-- ca_sync_schedule
CREATE TABLE public.ca_sync_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horario TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ca_sync_schedule TO authenticated;
GRANT ALL ON public.ca_sync_schedule TO service_role;
ALTER TABLE public.ca_sync_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_sync_schedule read for financeiro" ON public.ca_sync_schedule
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'financeiro'));

INSERT INTO public.ca_sync_schedule (horario, ordem) VALUES
  ('06:00', 1), ('12:00', 2), ('18:00', 3);

-- ca_sync_jobs (histórico/backfill)
CREATE TABLE public.ca_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  date_from DATE,
  date_to DATE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  mensagem TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT ON public.ca_sync_jobs TO authenticated;
GRANT ALL ON public.ca_sync_jobs TO service_role;
ALTER TABLE public.ca_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_sync_jobs read for financeiro" ON public.ca_sync_jobs
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'financeiro'));

-- pg_cron job a cada minuto para disparar o trigger automático
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('ca-sync-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ca-sync-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6426c238-9a04-43ca-bcba-50cca625fad7.lovable.app/api/public/contaazul/cron',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreXhydXRveHhkYXpwaHNiaHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTgzNzEsImV4cCI6MjA5MzA3NDM3MX0.NnHUXmBFrDH449bb61plzBzXKW3kjnaVhR4j1a7-5yQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
