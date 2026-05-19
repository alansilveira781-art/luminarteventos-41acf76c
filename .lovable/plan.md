
# Fase 1 — Ajustes nos módulos existentes

Esta fase entrega só Financeiro / Estoque / Compras. Os 3 módulos novos (Contábil, Jurídico, RH) ficam para a Fase 2.

---

## 1. Financeiro — nova aba "Rotinas"

Nova rota `/financeiro/rotinas` com 2 visualizações: **Tabela** e **Calendário**.

Cada rotina tem:
- Título (ex.: "Verificar pagamentos")
- Descrição (opcional)
- Frequência: diária / semanal / quinzenal / mensal / personalizada (dias da semana)
- Hora do dia
- Data de início e data de fim (a rotina deixa de se repetir após essa data)
- Responsável (usuário com acesso ao módulo financeiro)
- Status: ativa / pausada
- (futuro) marcar execução como concluída no dia

**Tabela**: lista, busca, filtros por responsável/frequência/status, CRUD inline com dialog.
**Calendário**: visão mensal (e semanal) expandindo cada rotina nas datas em que cai, considerando início/fim e frequência. Click em um evento abre o detalhe da rotina.

Sidebar do Comercial/Financeiro recebe novo item "Rotinas".

## 2. Estoque — campo Empresa nas entradas e saídas

Lista fixa em código: **Luminart Eventos**, **Luminart Planejados**, **Luminart Tecnologia** (helper em `src/lib/empresas.ts`).

- Nova coluna `empresa` em `movimentacoes` (texto, nullable para compatibilidade).
- Form de Entrada: select obrigatório de Empresa.
- Form de Saída: select obrigatório de Empresa (saída pode ser de empresa diferente da entrada — só campo informativo).
- Listagem de Entradas e Saídas: nova coluna Empresa + filtro.
- Modelos de importação Excel (`ENTRADA_TEMPLATE` e equivalente saída): adicionar coluna `empresa` com validação contra a lista fixa.
- Parser de NFe: tentar inferir empresa pelo CNPJ do destinatário; se não bater, deixa em branco e usuário escolhe.

## 3. Estoque — nova seção "Notas emitidas" (SEFAZ)

Dentro de `/entradas`, virar a página em **abas**:
- **Aba 1 — Entradas** (a tela atual, sem alteração de comportamento).
- **Aba 2 — Notas emitidas (SEFAZ)**: consulta de NFs emitidas no CNPJ de cada empresa.

Implementação:
- Integração via provedor terceirizado de NFe (sugestão: **Focus NFe** ou **PlugNotas** — confirmar com você antes de codar a integração final).
- Server function `consultarNotasSefaz({ empresa, periodo })` em `src/lib/sefaz/sefaz.functions.ts` que chama o provedor.
- Tabela `nfe_consultas` para cachear resultados (chave, emitente, destinatário, valor, data, status, XML link).
- UI: filtros por empresa + período, botão "Atualizar", lista com chave, fornecedor, valor, data, ações (ver detalhes, baixar XML, "Criar entrada a partir desta NF").
- Segredos necessários: token do provedor + certificado A1 (vou pedir via `add_secret` quando você confirmar o provedor).

## 4. Compras — reorganização das abas + Alerta de estoque

- Reordenar sidebar do Comercial→Compras para: **Dashboard** primeiro, depois Quadro de Compras.
- No Dashboard de Compras (`/compras/dashboard`):
  - Adicionar **card "Alerta de Estoque"** no topo, listando todos os itens com `status = 'baixo_estoque'` ou `'sem_estoque'` (lendo de `itens`).
  - Para cada item: nome, qtd atual, qtd mínima, badge de status, botão "Solicitar compra" que pré-preenche um novo card no Quadro de Compras com o item.
  - Mantém os widgets já existentes do dashboard abaixo.

---

## Detalhes técnicos

**Migrações de banco (uma migração só):**
```sql
-- rotinas financeiras
CREATE TABLE public.financeiro_rotinas (
  id uuid PK default gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  frequencia text NOT NULL,  -- 'diaria'|'semanal'|'quinzenal'|'mensal'|'custom'
  dias_semana int[],         -- 0..6 quando frequencia='custom' ou 'semanal'
  hora time NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  responsavel_id uuid,
  status text NOT NULL DEFAULT 'ativa',
  created_by uuid,
  created_at/updated_at timestamptz
);
-- RLS: has_module_access(auth.uid(),'financeiro')

-- empresa nas movimentações
ALTER TABLE public.movimentacoes ADD COLUMN empresa text;

-- cache de consultas SEFAZ
CREATE TABLE public.nfe_consultas (
  id uuid PK,
  empresa text NOT NULL,
  chave text NOT NULL UNIQUE,
  numero text, serie text,
  emitente_cnpj text, emitente_nome text,
  destinatario_cnpj text, destinatario_nome text,
  valor numeric, data_emissao timestamptz,
  status text, xml_url text,
  raw jsonb, synced_at timestamptz default now()
);
-- RLS: has_module_access(auth.uid(),'estoque')
```

**Arquivos novos:**
- `src/lib/empresas.ts` — lista fixa + helper.
- `src/routes/financeiro.rotinas.tsx` — página com tabs Tabela/Calendário.
- `src/components/financeiro/RotinaDialog.tsx` — form CRUD.
- `src/components/financeiro/RotinasCalendar.tsx` — visão calendário (usa `date-fns` + expansão de recorrência).
- `src/lib/sefaz/sefaz.functions.ts` — server functions de consulta NFe.
- `src/components/estoque/NotasSefaz.tsx` — UI da nova aba.
- `src/components/compras/AlertaEstoqueCard.tsx` — card do dashboard.

**Arquivos editados:**
- `src/components/AppSidebar.tsx` — novo item "Rotinas" no grupo Financeiro; reordenar Compras (Dashboard primeiro).
- `src/routes/entradas.tsx` — wrappear em `<Tabs>` (Entradas / Notas emitidas) + campo Empresa no form e na listagem.
- `src/routes/saidas.tsx` — campo Empresa no form e na listagem.
- `src/lib/import-utils.ts` — adicionar `empresa` em `ENTRADA_TEMPLATE` e criar `SAIDA_TEMPLATE` se faltar.
- `src/routes/compras.dashboard.tsx` — adicionar card de alerta no topo.

**Segredos (a pedir após escolha do provedor SEFAZ):**
- `FOCUS_NFE_TOKEN` (ou equivalente) — só quando você confirmar o provedor.

**Fora desta fase (Fase 2):** módulos Contábil, Jurídico, Recursos Humanos.
