## 1. Devoluções — Aumentar o formulário e remover rolagem horizontal

**Arquivo:** `src/routes/devolucoes.tsx`

- Dialog do "Nova devolução": aumentar a largura (`max-w-4xl` → `max-w-5xl` ou `sm:max-w-[1100px]`) para acomodar a tabela "Itens da saída" sem barra horizontal.
- Tabela interna `min-w-full table-fixed`: revisar `<colgroup>` para reduzir a largura mínima das colunas numéricas e usar `w-full` no container; trocar `whitespace-nowrap` em "Devolver agora" por uma largura fixa menor para o `Input` (`w-24`).
- Remover o `overflow-x-auto` da tabela interna (passa a caber) mantendo `overflow-x-auto` apenas como fallback responsivo.
- Ajustar `FormSection` (atualmente 3 colunas em `lg`) para continuar usando 3 colunas sem quebrar.

## 2. Financeiro — Reordenar abas na sidebar

**Arquivo:** `src/components/AppSidebar.tsx`

- Inverter a ordem dos dois itens do grupo "Financeiro" para ficar:
  1. Dashboard (`/financeiro/dashboard`)
  2. Quadro de Demandas (`/financeiro`)

## 3. Quadro de Demandas — Formulário/Card sem rolagem horizontal

**Arquivo:** `src/components/DemandaDialog.tsx`

- `DialogContent`: aumentar largura (`max-w-4xl` → `max-w-5xl`) e manter `max-h-[90vh] overflow-y-auto`.
- Garantir `min-w-0` nos containers internos (`Tabs`, `FormSection` filhos) e `w-full` nos `Input`/`Select`/`Textarea` para evitar overflow horizontal.
- Verificar o cabeçalho `DEMANDA-{numero}` (linha 132–136): usar `truncate` / `flex-wrap` para evitar estouro lateral em telas menores.
- Tab "Comentários" / "Histórico": garantir `break-words` / `min-w-0` nas linhas longas para não forçar rolagem.

## 4. Quadro de Demandas — Aba "Descritivo" com seletor de Evento/Projeto

**Arquivo:** `src/components/DemandaDialog.tsx` + nova tabela

- Criar tabela `eventos_projetos (id uuid pk, nome text unique, created_at)` via migration, com RLS liberado para usuários do módulo `financeiro` (mesma policy padrão das outras tabelas auxiliares como `parcelamentos`).
- Adicionar coluna `evento_projeto_id uuid` (e `evento_projeto text` para snapshot do nome) na tabela `demandas`.
- No tab "Descritivo", acima do `Textarea`, adicionar um `SelectCreatable table="eventos_projetos"` rotulado "Evento / Projeto" que salva nome em `evento_projeto` e id em `evento_projeto_id`.
- Atualizar o tipo `Demanda` em `DemandaDialog.tsx` para incluir os novos campos.

## 5. Quadro de Demandas — Remover "Material de Limpeza"

**Arquivo:** `src/lib/demandas.ts`

- Remover a entrada `{ value: "material_limpeza", label: "Material de Limpeza" }` de `TIPO_DEMANDA_OPTIONS`.
- Demandas existentes com esse valor continuam exibindo o valor cru no Select (sem quebra), e seguem aparecendo no Dashboard como rótulo `material_limpeza`. Isso é aceitável já que o usuário pediu apenas para retirar da lista de seleção.

## Detalhes técnicos

- Migration SQL (item 4):
  ```sql
  create table public.eventos_projetos (
    id uuid primary key default gen_random_uuid(),
    nome text not null unique,
    created_at timestamptz not null default now()
  );
  alter table public.eventos_projetos enable row level security;
  create policy "financeiro module access" on public.eventos_projetos
    for all to authenticated
    using (has_module_access(auth.uid(), 'financeiro'))
    with check (has_module_access(auth.uid(), 'financeiro'));

  alter table public.demandas
    add column if not exists evento_projeto text,
    add column if not exists evento_projeto_id uuid references public.eventos_projetos(id);
  ```
- Nenhum impacto nos módulos Estoque, Compras, Comercial ou Admin.
- Sem mudança de business logic além do novo campo.