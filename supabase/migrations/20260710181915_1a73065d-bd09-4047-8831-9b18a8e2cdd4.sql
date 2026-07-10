alter table public.eventos add column if not exists situacao text default 'Em Aprovação';
alter table public.eventos add column if not exists hora_montagem text;
alter table public.eventos add column if not exists hora_desmontagem text;