## Ajuste 1 — Quadro de Despesas: renomear rótulo da data

**`src/routes/financeiro.index.tsx`**
- No card, trocar o texto `Comprada:` por `Compra/Serviço:` na linha que renderiza `formatDate(demanda.data_compra)`. Sem mudanças no banco nem no nome do campo.

**`src/components/DemandaDialog.tsx`** (verificar)
- Se existir um label `Data da compra`, trocar para `Data da compra/serviço`. Apenas o texto visível; o campo `data_compra` permanece.

---

## Ajuste 2 — Módulo Compras: novo campo `data_servico`

### 2.1 Migration
```sql
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS data_servico date;
```
Sem alterar `data_compra`, RLS, grants ou políticas.

### 2.2 `src/components/CompraDialog.tsx`
- Adicionar `data_servico?: string | null` ao tipo do form (junto de `data_compra`).
- Incluir `data_servico` no estado inicial e ao carregar a compra existente.
- Substituir o `FormField` de `Data da compra` por renderização condicional:
  - `form.tipo_compra === "servico"` → renderizar **apenas** `FormField label="Data do serviço"` ligado a `form.data_servico`.
  - Caso contrário (mercadoria/vazio) → renderizar **apenas** `FormField label="Data da compra"` como hoje.
- Incluir `data_servico` no patch enviado no save (insert e update).

### 2.3 `src/routes/compras.index.tsx`
- Adicionar `data_servico` ao `.select(...)` da query de compras.
- Adicionar `data_servico: string | null` ao tipo `Compra`.
- No card, substituir a linha `Comprada: …` por condicional:
  - `compra.tipo_compra === "servico"` → `Serviço: ${formatDate(compra.data_servico)}` (ou `Sem data de serviço` se nulo).
  - Caso contrário → mantém `Comprada: ${formatDate(compra.data_compra)}` exatamente como hoje.

---

## Fora de escopo
Nada de mudanças em status, permissões (`canMoveCompra`, Pedro, Natanael), drag-and-drop, valores de `tipo_compra`, RLS ou outras telas (dashboard, solicitar, etc.).
