## Módulo Diaristas — Etapa 1 (estrutura + configurações)

Criar a base do submódulo **Diaristas** dentro do grupo **Financeiro** (o mesmo grupo que hoje contém "Quadro de Despesas" / "Configurações" — slug de módulo `financeiro`). Nesta etapa entregamos apenas a estrutura de dados, a navegação e a tela de cadastro. Apontamento e fechamento ficam para as próximas etapas.

### 1. Banco de dados (migração)

Duas tabelas novas em `public`, com GRANTs e RLS.

- **`public.diaristas`**
  - `nome` (obrigatório), `valor_hora_fortaleza` (numeric, default 0), `valor_hora_fora` (numeric, default 0), `chave_pix`, `ativo` (boolean, default true).
  - RLS: leitura/escrita para usuários com acesso ao módulo `financeiro` (via `has_module_access(auth.uid(),'financeiro')`), admin geral libera tudo. `service_role` full.
- **`public.diarista_apontamentos`** (só criada agora; usada nas próximas etapas)
  - `diarista_id` (fk → diaristas), `empresa`, `atividade`, `projeto`, `comodos`, `data` (obrigatória), `hora_inicial` / `hora_final` (time, obrigatórias), `intervalo_minutos` (int, default 0), `local` (text default `'fortaleza'`, valores esperados `fortaleza`|`fora`), `obs`, `extra_manual` (numeric, default 0), `created_by` (uuid).
  - RLS igual à de `diaristas`.
- Ambas com `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` + trigger `set_updated_at`. GRANTs `SELECT/INSERT/UPDATE/DELETE` para `authenticated`, `ALL` para `service_role` (sem `anon`).

### 2. Navegação e rotas

- **`src/components/AppSidebar.tsx`**: adicionar item **"Diaristas"** no grupo `Despesas` (o grupo que corresponde às abas de `/financeiro/*`), com `module: "financeiro"`, apontando para `/financeiro/diaristas`. A entrada de Configurações vira uma sub-tela dentro da própria página de Diaristas (botão/aba interna), para não poluir a sidebar; caso prefira item separado, adicionamos `moduleAdminOnly: "financeiro"` apontando para `/financeiro/diaristas/configuracoes`.
- **`src/routes/financeiro.diaristas.tsx`**: rota layout que renderiza `<Outlet />`. Segue o mesmo padrão de guarda de `src/routes/financeiro.tsx` (checa `hasModule("financeiro")`).
- **`src/routes/financeiro.diaristas.index.tsx`**: placeholder "Em breve — apontamento e fechamento" (implementados nas próximas etapas).
- **`src/routes/financeiro.diaristas.configuracoes.tsx`**: tela de cadastro (ver item 3). Exige `isAdmin` OU `modulos.some(m => m.slug==='financeiro' && m.is_admin)`, senão `Navigate` para `/financeiro/diaristas`.

### 3. Tela de Configurações (cadastro de diaristas)

Mesmo padrão visual das seções de `comercial.configuracoes.tsx` (Card + tabela + Dialog de edição), reutilizando `PageHeader`, `Card`, `Dialog`, `Input`, `Switch` e `MoneyInput` já existentes.

- Tabela com colunas: **Nome**, **Valor/Hora Fortaleza**, **Diária Fortaleza** (calculada = valor/hora × 8, apenas para conferência), **Valor/Hora Fora**, **Diária Fora** (× 8), **Chave Pix**, **Ativo** (switch inline), **Ações** (editar / excluir).
- Dialog "Novo/Editar diarista" com os campos: Nome (text), Valor/Hora Fortaleza (MoneyInput), Valor/Hora Fora (MoneyInput), Chave Pix (text), Ativo (Switch). Validação simples: nome obrigatório.
- Hook local `useDiaristas` com TanStack Query (`queryKey: ['diaristas']`) e mutations `upsert` / `remove` batendo direto em `supabase.from('diaristas')`, invalidando a query e usando `toast` para feedback — mesmo padrão dos hooks de `src/lib/comercial/cadastros.ts`.

### Fora de escopo (fica para as próximas etapas)

- Tela de apontamento diário, cálculo de horas trabalhadas / horas extras, fechamento por período, integração com Quadro Financeiro, exportação/pagamento.

### Detalhes técnicos

- Migração via `supabase--migration` (uma só, com as duas tabelas, GRANTs, RLS, políticas e triggers). Depois criar rotas/componentes.
- Rotas TanStack usam o padrão de arquivos com pontos já adotado no projeto (`financeiro.diaristas.tsx` = layout, `financeiro.diaristas.index.tsx` = leaf, `financeiro.diaristas.configuracoes.tsx` = leaf).
- Sidebar: item de menu aparece só quando o contexto atual é `financeiro` (função `getContext` em `AppSidebar.tsx`) — já está mapeado para rotas `/financeiro/*`, então "Diaristas" cai naturalmente no grupo `Despesas` sem mudanças na função de contexto.