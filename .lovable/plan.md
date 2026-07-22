## 1. Quadro de Vendas — arrastar o card inteiro

**Arquivo:** `src/routes/comercial.index.tsx`

- No `KanbanCard`, aplicar `useDraggable` (`listeners`/`attributes`) no wrapper do card, e não só no botão `⋮⋮`.
- Manter o `⋮⋮` como alça visual (mesmos listeners) — continua funcionando, mas o card todo passa a ser pegador.
- Envolver os botões de ação (Editar, Detalhes, Marcar venda/perda, Criar Proposta, Imprimir) com `onPointerDown={(e) => e.stopPropagation()}` para que o clique nunca seja interpretado como início de arraste.
- Manter `activationConstraint: { distance: 5 }` no `PointerSensor`, evitando que um clique curto em texto vire drag acidental.

## 2. Configurações do Comercial — liberar abas do Dashboard por usuário

**Objetivo:** admin escolhe, por usuário, quais das 4 seções do Dashboard Comercial ele enxerga: Painel de Vendas, Relatório de Vendas, Vendedores, Indicadores. Também controla se o usuário vê a página Dashboard.

### Modelo de dados (migração)

Nova tabela `comercial_dashboard_permissoes`:

- `user_id uuid` (FK `auth.users`, único)
- `ver_painel bool default true`
- `ver_relatorio bool default true`
- `ver_vendedores bool default true`
- `ver_indicadores bool default true`

RLS:
- Admin (via `has_role`): `ALL`.
- Usuário autenticado: `SELECT` da própria linha (para o front saber o que renderizar).

Grants padrão (`authenticated`, `service_role`). Sem acesso `anon`.

Regra de fallback quando o usuário **não tem linha**: para admins do módulo comercial, tudo liberado; para usuários comuns com o módulo comercial, só a aba **Vendedores** liberada por padrão (assim já resolve o caso "vendedor só vê o dele").

### UI — `src/routes/comercial.configuracoes.tsx`

Novo card **"Acesso ao Dashboard"** (visível só para admin do comercial):

- Lista os usuários com o módulo `comercial` (join `user_modulos` + `profiles`/`auth`).
- Cada linha traz 4 switches (Painel / Relatório / Vendedores / Indicadores) que fazem `upsert` na nova tabela.

### Aplicação das permissões

- **`src/routes/comercial.dashboard.tsx`**: `useQuery` na tabela para o usuário logado; expõe `permissoes` via `DashboardCtx` (adicionar campo). Se todas as flags forem `false`, mostrar mensagem "Você não tem acesso ao Dashboard" ao invés do `<Outlet />`.
- **`src/routes/comercial.dashboard.index.tsx`**:
  - Ocultar botões das seções não liberadas em `Secao`.
  - Ao carregar, escolher `secao` inicial como a primeira liberada.
  - Se o usuário mudar `secao` para uma proibida (não acontece pelos botões, mas guarda), força para a primeira liberada.
- **`src/components/AppSidebar.tsx`**: quando nenhuma das 4 flags estiver ativa, esconder o item "Dashboard" do grupo Comercial (para usuários não-admin). Usa o mesmo hook/consulta.

## 3. Aba Vendedores — filtro fixo no próprio vendedor

**Regra combinada:** casar `user.user_metadata.full_name` (ou `profiles.nome`) com `comercial_vendedores.nome`, normalizando (trim, minúsculas, sem acentos).

**Arquivo:** `src/routes/comercial.dashboard.index.tsx` (bloco `secao === "vendedores"`).

- Se o usuário for admin do comercial → mantém o `Select` de consultor com "Todos" e a lista completa.
- Se **não** for admin:
  - Calcular `meuNome` a partir do perfil.
  - Procurar em `consultoresDisponiveis` a entrada que casa com `meuNome` normalizado.
  - Setar `consultorSel` fixo nesse nome e **ocultar o Select** (mostrar um chip "Vendedor: Fulano").
  - Se não achar correspondência, mostrar aviso "Seu usuário ainda não está vinculado a um vendedor cadastrado — peça ao administrador para ajustar o nome nas Configurações → Vendedores".
- Como a seção Vendedores já ficará com `consultorSel` travado, todos os gráficos/KPIs já ficam filtrados só nesse vendedor.

## 4. Observações

- Nenhuma mudança em Painel/Relatório/Indicadores além do controle de visibilidade — os dados continuam globais para quem tem acesso a essas abas.
- O vínculo por nome depende do cadastro estar exatamente com o mesmo nome do usuário; a mensagem de aviso já orienta a correção sem quebrar a tela.
- Migração roda antes das mudanças de código (o types.ts é regenerado depois da aprovação).

### Detalhes técnicos (para revisão)

```text
comercial_dashboard_permissoes
  user_id (PK, FK auth.users)
  ver_painel, ver_relatorio, ver_vendedores, ver_indicadores (bool)
  created_at, updated_at

RLS
  admin  → ALL
  self   → SELECT WHERE user_id = auth.uid()
```

Ordem de implementação:
1. Migração da tabela + RLS + grants.
2. Card de permissões nas Configurações.
3. Hook `useDashboardPermissoes` + gating em `comercial.dashboard.tsx` / `index.tsx` / `AppSidebar.tsx`.
4. Filtro travado na aba Vendedores.
5. Arraste do card inteiro no Quadro.
