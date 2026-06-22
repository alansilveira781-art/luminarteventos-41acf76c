ALTER TABLE public.movimentacao_itens REPLICA IDENTITY FULL;
ALTER TABLE public.compras REPLICA IDENTITY FULL;
ALTER TABLE public.compra_itens REPLICA IDENTITY FULL;
ALTER TABLE public.pat_itens REPLICA IDENTITY FULL;
ALTER TABLE public.pat_movimentacoes REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'movimentacao_itens',
    'compras',
    'compra_itens',
    'pat_itens',
    'pat_movimentacoes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN
        IF SQLERRM LIKE '%is already member of publication%' THEN NULL;
        ELSE RAISE;
        END IF;
    END;
  END LOOP;
END $$;