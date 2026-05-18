-- Credenciais (linha única)
create table if not exists public.conta_azul_credentials (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_by uuid,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conta_azul_credentials enable row level security;
drop policy if exists "financeiro admin manage" on public.conta_azul_credentials;
create policy "financeiro admin manage" on public.conta_azul_credentials
  for all to authenticated
  using (is_module_admin(auth.uid(), 'financeiro'))
  with check (is_module_admin(auth.uid(), 'financeiro'));

-- Plano de contas
create table if not exists public.ca_plano_contas (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  codigo text,
  nome text not null,
  tipo text,
  pai_external_id text,
  ativo boolean not null default true,
  synced_at timestamptz not null default now()
);
alter table public.ca_plano_contas enable row level security;
drop policy if exists "financeiro module access" on public.ca_plano_contas;
create policy "financeiro module access" on public.ca_plano_contas
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

-- Centros de custo
create table if not exists public.ca_centros_custo (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  nome text not null,
  ativo boolean not null default true,
  synced_at timestamptz not null default now()
);
alter table public.ca_centros_custo enable row level security;
drop policy if exists "financeiro module access" on public.ca_centros_custo;
create policy "financeiro module access" on public.ca_centros_custo
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

-- Contas a pagar
create table if not exists public.ca_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  descricao text,
  fornecedor_nome text,
  categoria_external_id text,
  centro_custo_external_id text,
  valor numeric(14,2) not null default 0,
  data_vencimento date,
  data_pagamento date,
  status text,
  documento text,
  observacoes text,
  synced_at timestamptz not null default now()
);
create index if not exists ca_contas_pagar_venc_idx on public.ca_contas_pagar(data_vencimento);
create index if not exists ca_contas_pagar_status_idx on public.ca_contas_pagar(status);
alter table public.ca_contas_pagar enable row level security;
drop policy if exists "financeiro module access" on public.ca_contas_pagar;
create policy "financeiro module access" on public.ca_contas_pagar
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

-- Contas a receber
create table if not exists public.ca_contas_receber (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  descricao text,
  cliente_nome text,
  categoria_external_id text,
  centro_custo_external_id text,
  valor numeric(14,2) not null default 0,
  data_vencimento date,
  data_pagamento date,
  status text,
  documento text,
  observacoes text,
  synced_at timestamptz not null default now()
);
create index if not exists ca_contas_receber_venc_idx on public.ca_contas_receber(data_vencimento);
create index if not exists ca_contas_receber_status_idx on public.ca_contas_receber(status);
alter table public.ca_contas_receber enable row level security;
drop policy if exists "financeiro module access" on public.ca_contas_receber;
create policy "financeiro module access" on public.ca_contas_receber
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

-- Extrato bancário
create table if not exists public.ca_extrato (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  conta_bancaria text,
  data date,
  descricao text,
  valor numeric(14,2) not null default 0,
  tipo text,
  categoria_external_id text,
  centro_custo_external_id text,
  synced_at timestamptz not null default now()
);
create index if not exists ca_extrato_data_idx on public.ca_extrato(data);
alter table public.ca_extrato enable row level security;
drop policy if exists "financeiro module access" on public.ca_extrato;
create policy "financeiro module access" on public.ca_extrato
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));

-- Log de sincronização
create table if not exists public.ca_sync_log (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'em_andamento',
  mensagem text,
  qtd_registros integer
);
alter table public.ca_sync_log enable row level security;
drop policy if exists "financeiro module access" on public.ca_sync_log;
create policy "financeiro module access" on public.ca_sync_log
  for all to authenticated
  using (has_module_access(auth.uid(), 'financeiro'))
  with check (has_module_access(auth.uid(), 'financeiro'));