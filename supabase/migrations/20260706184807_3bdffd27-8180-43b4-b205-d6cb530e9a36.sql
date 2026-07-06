ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;