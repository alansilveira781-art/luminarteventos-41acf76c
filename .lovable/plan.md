## Objetivo

Levar a entrada no estoque para dentro do próprio card de despesa (DemandaDialog), com lista de itens editável na aba "Descritivo" quando o tipo for fardamento/material_limpeza/material_escritorio, gravando em uma nova tabela `demanda_itens`. Remover a página separada `/financeiro/a-receber` criada anteriormente.

## Parte 1 — Migração `demanda_itens`

Nova migration espelhando `compra_itens`:

- Tabela `public.demanda_itens` com: `demanda_id (fk demandas on delete cascade)`, `item_id (fk itens)`, `descricao`, `unidade`, `quantidade`, `valor_unitario`, `recebido bool`, `quantidade_recebida`, `recebido_em`, timestamps.
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role`.
- RLS habilitado com policy espelhando a de `compra_itens` (verifico via `supabase--read_query` no início da build).
- Índice em `demanda_id`.

Sem mexer no enum: `compra_status` já tem `a_receber`.

## Parte 2 — Descritivo condicional no DemandaDialog

Em `src/components/DemandaDialog.tsx`, aba "Descritivo":

- Se `form.tipo_demanda ∈ {fardamento, material_limpeza, material_escritorio}`: substitui o Textarea por uma lista de itens editável (mesmo padrão da aba "Itens" de `CompraDialog`): linhas com `ItemSearchSelect`, descrição, unidade, quantidade, `MoneyInput` para valor unitário, subtotal por linha, total geral, botões adicionar/remover.
- Caso contrário: mantém o Textarea de descritivo atual.
- Evento/Projeto continua acima em ambos os casos.

Estado local `itens: DemandaItem[]` carregado via query quando `demandaId` existe (`select * from demanda_itens where demanda_id = ?`).

Na mutation `save`:
- Grava a demanda como hoje.
- Se o tipo for um dos três: `delete from demanda_itens where demanda_id = id` e reinsere a lista atual (mesma estratégia do CompraDialog).
- Se não for: não toca em `demanda_itens`.

## Parte 3 — Coluna "A Receber" + regra de próximo status

Já implementado em passos anteriores (verifico e mantenho):
- `DEMANDA_STATUSES` inclui `a_receber` antes de `finalizado`.
- `proximoStatusDemanda(status, tipo)` roteia `em_andamento → a_receber` só para os três tipos.
- `financeiro.index.tsx` usa `proximoStatusDemanda(c.status, c.tipo_demanda)` e traz `tipo_demanda` no select.

Nada novo aqui além de confirmar.

## Parte 4 — Validar recebimento a partir do card

No `DemandaDialog`, quando `form.status === 'a_receber'` e o tipo for um dos três, adicionar botão **"Validar recebimento"** no rodapé (ao lado de Avançar). Ele abre um sub-dialog compacto que:

1. Lista os itens da demanda (de `demanda_itens`) com quantidade editável (default = `quantidade`).
2. Ao confirmar:
   - Revalida `select status from demandas where id = ?` — precisa estar em `a_receber`.
   - Gera `requisicao_numero` via RPC `next_requisicao_numero`.
   - Para cada linha, insere em `movimentacoes`: `tipo:'entrada'`, `entrada_tipo:'compra'`, `item_id`, `quantidade`, `valor_unitario`, `valor_total = qtd*vu`, `empresa` (usa `empresa` da demanda se houver, senão default), `data_movimento: hoje`, `requisicao_numero`, `observacao: 'DESPESA-<numero>'`.
   - Atualiza `demanda_itens.recebido=true`, `quantidade_recebida`, `recebido_em=now()`.
   - Atualiza `demandas.status='finalizado'`.
   - Invalida queries: `demandas`, `itens`, `entradas`, `item-movs`, `dashboard-*`.

Fecha o card ao final.

## Parte 5 — Limpeza da tentativa anterior

- Deletar `src/routes/financeiro.a-receber.tsx` (fluxo agora vive no card).
- Remover o item "A receber" das Despesas em `src/components/AppSidebar.tsx`.
- Regenerar `routeTree.gen.ts` (automático no build).

## Detalhes técnicos

- Uso `sb as any` como o restante do arquivo para acessar a nova tabela sem esperar regenerar `types.ts`.
- Padrão idêntico ao `CompraDialog` para itens: precisa que eu leia rapidamente a seção "Itens" desse arquivo antes de codar, para copiar exatamente o layout/lógica.
- Antes de escrever a migration, leio as policies de `compra_itens` via `supabase--read_query` e espelho.

## Ordem de execução

1. `supabase--read_query` para policies de `compra_itens` e schema de `movimentacoes` (confirmar colunas usadas no recebimento em `estoque.a-receber.tsx`).
2. `supabase--migration` para `demanda_itens`.
3. Edições em `DemandaDialog.tsx` (lista de itens + botão validar).
4. Delete de `financeiro.a-receber.tsx` e limpeza do sidebar.
5. Verificação de build.

## Respostas prometidas ao final

(1) Precisou de migration no enum? Não — `compra_status` já aceita `a_receber`.
(2) Onde ficou o botão de validar? No rodapé do próprio DemandaDialog, visível quando o card está em "A Receber" e o tipo exige estoque.
(3) Confirmação de que a entrada cai em `itens`/`movimentacoes` no mesmo formato que Compras — os triggers existentes (`apply_movement`, custo médio, refresh_status) rodam normalmente.
