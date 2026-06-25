## Quadro de Despesas — Botão Avançar + Aprovar/Reprovar

Replicar no Quadro de Despesas o mesmo padrão de avanço já existente no Quadro de Compras, e adicionar botão "Reprovar" também em Compras.

### Arquivos a alterar (4)

**1. `src/components/DemandaDialog.tsx`**
- Exportar tipo `DemandaAdvanceOpts = { approve?: boolean; deny?: boolean }`.
- Adicionar prop opcional `onAdvance?(demanda, opts?)`.
- Adicionar imports `ChevronRight, CheckCircle2, XCircle` do lucide-react.
- No `DialogFooter`, antes do botão "Cancelar", injetar lógica:
  - Se `status === "pendente_aprovacao"` → botões **Aprovar demanda** (verde) e **Reprovar demanda** (vermelho/destructive).
  - Caso contrário → botão **Avançar para "<próximo>"** (pula `negada`, ignora terminal).
- Preservar botões "Excluir", "Cancelar" e "Salvar".

**2. `src/routes/financeiro.index.tsx`** (Quadro de Despesas)
- Imports: `ChevronRight`, `AvancarCardDialog`, `notifyResponsavel`, tipo `DemandaAdvanceOpts`.
- Estado `pendingMove` para fluxo de seleção de responsável quando não há default.
- Helpers `nextStatus(s)` (pula `negada`) e `advanceToStatus(demanda, status, opts)` que:
  - Usa responsável default do `statusDefaults` quando existir (move + notifica).
  - Se `opts.force` (aprovar/reprovar), move direto sem exigir responsável.
  - Senão, abre `AvancarCardDialog` para escolher responsável.
- Atualizar render do kanban: cada `Card` recebe `nextStatusLabel` e `onAdvance` (quando há próximo status).
- Passar `onAdvance` ao `DemandaDialog`, derivando target por `opts.approve`/`opts.deny`/sequencial.
- Renderizar `AvancarCardDialog` controlado por `pendingMove`.
- Componente `Card`: adicionar botão `ChevronRight` à direita (com `stopPropagation`), e nova linha `Resp.: …` quando houver `responsavel_nome`.

**3. `src/components/CompraDialog.tsx`** (bônus)
- Adicionar `XCircle` ao import lucide-react.
- Estender `AdvanceOpts` com `deny?: boolean`.
- No status `pendente_aprovacao`, exibir **Aprovar compra** + **Reprovar compra** (lado a lado), ambos validados por `canMoveCompra` para os destinos `aprovada`/`negada`.

**4. `src/routes/compras.index.tsx`**
- No `onAdvance` passado ao `CompraDialog`, tratar `opts.deny` → `target = "negada"` com `force: true` e toast "Compra reprovada.".

### Não tocar
- `src/lib/demandas.ts`, `src/lib/compras.ts` (regras), banco/migrations, drag-and-drop, demais módulos, botão Excluir.

### Notas técnicas
- Reuso de `AvancarCardDialog` e `notifyResponsavel` mantém paridade com Compras.
- Status `negada` é alcançável apenas via botão "Reprovar"; o avanço sequencial sempre pula `negada`.
- Permissões: Despesas continuam abertas (qualquer autenticado pode avançar); Compras seguem usando `canMoveCompra`.
