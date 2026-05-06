CREATE TABLE IF NOT EXISTS public.compradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compradores_select_auth" ON public.compradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "compradores_insert_auth" ON public.compradores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "compradores_delete_auth" ON public.compradores FOR DELETE TO authenticated USING (true);
CREATE POLICY "compradores_update_auth" ON public.compradores FOR UPDATE TO authenticated USING (true);