
## 1) Quadro Financeiro (novo kanban em Financeiro OP)

**Migração**
- `compras`: adicionar `status_financeiro text` (nullable), `financeiro_ordem numeric`.
- `demandas`: mesmas duas colunas.
- Sem enum novo — usar text simples com valores: `caixa_entrada`, `analise_financeira`, `lancamento`, `finalizado_fin`.
- Trigger `AFTER UPDATE` em `compras` e `demandas`: quando `NEW.status = 'finalizado'` e `NEW.status_financeiro IS NULL`, seta `status_financeiro = 'caixa_entrada'`. Isso garante entrada automática mesmo em fluxos que não passam pelas mutations do frontend (drag no kanban, mudanças via triggers já existentes de status).

**Novo arquivo `src/lib/financeiro-quadro.ts`**
- Exporta `FINANCEIRO_STATUSES` (array ordenado com key/label/color) espelhando o formato de `COMPRA_STATUSES`.

**Nova rota `src/routes/financeiro-op.quadro.tsx`**
- Gate por `hasModule("financeiro_op") || isAdmin` (padrão do layout `financeiro-op.tsx` já cobre acesso à área; página em si segue padrão dos demais).
- Duas queries paralelas: `compras` e `demandas` com `status_financeiro not null`, projetando id, numero, titulo, fornecedor, valor_total, solicitante, status_financeiro, financeiro_ordem.
- Unir em lista única com campo `origem: 'compra' | 'demanda'`.
- Render kanban com 4 colunas seguindo padrão visual de `compras.index.tsx` (DndContext, DragOverlay, colunas droppable).
- Card: número, título, badge origem (Compra/Despesa), fornecedor, valor formatado BRL, solicitante.
- Clique no card abre Dialog somente leitura reutilizando estilo do `PedidoDetalheDialog` de `meus-pedidos.tsx` (dados + itens de `compra_itens`/`demanda_itens`).
- Drag habilitado apenas se `hasModule("financeiro_op") || isAdmin`; caso contrário quadro é somente leitura.
- Mutation onDrop: `update` em `compras` ou `demandas` (conforme `origem`) setando `status_financeiro` e `financeiro_ordem`.

**Sidebar (`src/components/AppSidebar.tsx`)**
- Adicionar item "Quadro Financeiro" no grupo Financeiro (module `financeiro_op`) → `/financeiro-op/quadro`.

**RLS**: as tabelas já têm policies existentes; as novas colunas herdam. Verificar que o UPDATE só é permitido para quem tem acesso — atualmente as policies de `compras`/`demandas` já cobrem edição por responsáveis/admin/module_admin. Ampliar policy de UPDATE para permitir que usuários com `has_module_access('financeiro_op')` alterem `status_financeiro`/`financeiro_ordem` (política adicional específica).

**Quadros existentes**: intocados exceto pelas duas colunas novas e pela trigger de entrada automática.

---

## 2) Produtor em Eventos

**Migração**
- `CREATE TABLE public.produtores (id uuid pk default gen_random_uuid(), nome text not null, created_at timestamptz default now())`.
- GRANT SELECT/INSERT/UPDATE/DELETE para `authenticated`, ALL para `service_role`.
- RLS enabled, política: leitura/escrita para quem tem `has_module_access('eventos')` ou admin.
- `ALTER TABLE eventos ADD COLUMN produtor_id uuid REFERENCES public.produtores(id) ON DELETE SET NULL`.

**Nova rota `src/routes/eventos.configuracoes.tsx`**
- CRUD simples de produtores seguindo padrão de `comercial.configuracoes.tsx` (tabela + dialog novo/editar/excluir).
- Sidebar: adicionar "Configurações" no grupo Eventos → `/eventos/configuracoes`.

**Formulário de Evento (`src/routes/eventos.index.tsx`)**
- Adicionar Select "Produtor" populado por `produtores`, salvando `produtor_id`.

**Calendário (dentro de `eventos.index.tsx` ou componente do calendário)**
- Junto ao status (aprovado / em aprovação) de cada evento, mostrar o nome do produtor. Se `produtor_id` for null, não renderiza nada.
- Buscar via lookup em memória (map de produtores por id, já carregado para o Select).

---

## 3) "Ocultar Finalizados" em Meus Pedidos

Em `src/routes/meus-pedidos.tsx`:
- Adicionar `useState<boolean>(false)` para `hideFinalizados`.
- Renderizar `Switch` com label "Ocultar Finalizados" no topo (acima da lista).
- Aplicar filtro no `useMemo` de `pedidos`: quando ativo, excluir itens com `status === 'finalizado'`.
- Sem persistência, sem alterações adicionais.

---

## Ordem de execução
1. Migração única com: colunas novas em `compras`/`demandas`, trigger de entrada automática, tabela `produtores`, coluna `produtor_id` em `eventos`, RLS/GRANT.
2. `src/lib/financeiro-quadro.ts`.
3. Rota `financeiro-op.quadro.tsx`.
4. Rota `eventos.configuracoes.tsx` + ajustes em `eventos.index.tsx` (form + calendário).
5. `meus-pedidos.tsx` toggle.
6. `AppSidebar.tsx` com os dois novos itens.
