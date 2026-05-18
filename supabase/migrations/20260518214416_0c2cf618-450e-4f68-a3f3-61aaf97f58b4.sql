create table if not exists public.eventos_projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
alter table public.eventos_projetos enable row level security;
drop policy if exists "financeiro module access" on public.eventos_projetos;
create policy "financeiro module access" on public.eventos_projetos
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

alter table public.demandas
  add column if not exists evento_projeto text,
  add column if not exists evento_projeto_id uuid references public.eventos_projetos(id);