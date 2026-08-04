ALTER TABLE public.op_ordem_checklist ADD COLUMN IF NOT EXISTS responsavel_id uuid;
ALTER TABLE public.op_ordem_setores ADD COLUMN IF NOT EXISTS prazo date;