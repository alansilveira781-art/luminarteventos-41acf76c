# Separar Módulo "Despesas" e criar novo módulo "Financeiro"

Dividir o módulo atual em dois: **Despesas** (mantém slug `financeiro`, rotas `/financeiro/*`) com apenas Quadro + Dashboard de Despesas + Configurações; e novo módulo **Financeiro** (slug `financeiro_op`, rotas `/financeiro-op/*`) contendo Rotinas Financeiras, Conta Azul e um Dashboard com abas Conta Azul + Uber.

## Passos

1. **`src/routes/financeiro.dashboard.tsx`** — Remover `Tabs`, `UberDashboard`, `ContaAzulDashboard` e `validateSearch`. Manter apenas o conteúdo atual da aba "Despesas" (KPIs, gráficos e DRE de demandas).

2. **`src/routes/financeiro-op.tsx`** (novo) — Layout guard que valida `hasModule("financeiro_op")` e renderiza `<Outlet />`.

3. **`src/routes/financeiro-op.index.tsx`** (novo) — `<Navigate to="/financeiro-op/dashboard" />`.

4. **`src/routes/financeiro-op.dashboard.tsx`** (novo) — Dashboard com abas `contaazul` (default) e `uber`, com filtros de data para Uber, usando os componentes existentes.

5. **`src/routes/financeiro-op.rotinas.tsx`** (novo) — Cópia integral de `financeiro.rotinas.tsx` trocando apenas o path do `createFileRoute` para `/financeiro-op/rotinas`.

6. **`src/routes/financeiro-op.conta-azul.tsx`** (novo) — Cópia integral de `financeiro.conta-azul.tsx` trocando apenas o path para `/financeiro-op/conta-azul`.

7. **`src/components/AppSidebar.tsx`**:
   - Remover "Rotinas Financeiras" e "Conta Azul" do grupo Despesas.
   - Adicionar grupo "Financeiro" com Dashboard / Rotinas / Conta Azul apontando para `/financeiro-op/*` e `module: "financeiro_op"`.
   - Inserir `"Financeiro"` no array `groups` após `"Despesas"`.
   - Adicionar `FINANCEIRO_OP_ROUTES` e o branch correspondente em `getContext`, ampliando o tipo de retorno.
   - Em `useNavItems`, filtrar `module === "financeiro_op"` por contexto + acesso.

8. **`src/routes/index.tsx`** — Adicionar `financeiro_op: "DollarSign"` ao `iconFor`.

9. **Migration Supabase** — `INSERT` em `public.modulos` para registrar `financeiro_op` (nome "Financeiro", rota `/financeiro-op`, ícone `DollarSign`, ativo) com `ON CONFLICT DO NOTHING`.

## Observações técnicas

- O novo módulo reutiliza as mesmas tabelas (`demandas`, `ca_*`, `uber_*`) — sem mudanças de RLS.
- Permissões: usuários precisarão ser vinculados manualmente ao módulo `financeiro_op` em `user_modulos` (admins têm acesso automático).
- `financeiro.tsx` (layout guard atual), `financeiro.index.tsx`, `financeiro.configuracoes.tsx`, `financeiro.rotinas.tsx` e `financeiro.conta-azul.tsx` permanecem intactos para não quebrar referências/links existentes — apenas saem da sidebar do módulo Despesas.
