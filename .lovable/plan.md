
## 1) Patrimônio — Saídas (form maior + múltiplos itens + códigos na tabela)

**`src/components/patrimonio/Movimentacoes.tsx`** (componente reusado por Entradas/Saídas)

- Aumentar o `DialogContent` de `max-w-2xl` para `max-w-5xl w-[min(1100px,96vw)] max-h-[90vh] overflow-y-auto` para acabar com o scroll horizontal.
- Reformular o `MovDialog` para suportar **múltiplos itens em uma saída** (espelhando o padrão de `src/routes/saidas.tsx`):
  - Cabeçalho único: Data, Responsável (combobox de solicitantes do estoque, livre p/ digitar), Evento/Projeto (`EventoSheetCombobox`), Finalidade, Previsão de devolução, Observações.
  - Seção "Itens da saída" com lista de linhas `{ item_id, quantidade }`, botão "Adicionar item" e remover, usando `ItemSearchSelect` (já busca por COD/ID/nome).
  - Validação: pelo menos uma linha válida; quantidade > 0.
- **Persistência agrupada por requisição:**
  - Adicionar coluna `requisicao_numero` em `pat_movimentacoes` (migration nova) + sequence `pat_requisicao_numero_seq` + RPC `next_pat_requisicao_numero()`.
  - Ao salvar saída, obter um único `requisicao_numero` e inserir N linhas (uma por item) compartilhando todos os metadados.
  - Em edição: editar grupo inteiro (apagar linhas antigas e reinserir mantendo o `requisicao_numero`), bloqueando edição se houver devoluções vinculadas.
- **Tabela de Saídas** (apenas no `tipo="saida"`):
  - Agrupar por `requisicao_numero` (linhas sem número viram grupos individuais).
  - Coluna inicial **REQ** (`REQ-0001`), linha expansível mostrando subtabela com **Código (id_item)**, Nome, Qtd, UN — espelhando o expand do módulo Estoque.
  - Mantém colunas Responsável, Evento/Projeto, Finalidade, Prev. devol.
- Entradas continua single-item (sem mudança estrutural além do tamanho do dialog).

## 2) Patrimônio — nova aba "Devoluções"

- Nova rota `src/routes/patrimonio.devolucoes.tsx` + entrada na sidebar (`src/components/AppSidebar.tsx`) no grupo Patrimônio com ícone `Undo2`.
- Novo componente `src/components/patrimonio/Devolucoes.tsx` (espelhando `src/routes/devolucoes.tsx`):
  - Lista devoluções (`pat_movimentacoes` com `tipo='devolucao'`), com filtro de período/busca e exclusão (revertendo nada de estoque — patrimônio só rastreia movimentação).
  - Dialog "Nova devolução": combobox de **saídas em aberto** agrupadas por `requisicao_numero`, exibindo data + responsável + evento; ao escolher, listar os itens da saída com input de quantidade devolvida (validado contra `qtd_saida − já_devolvido`), campo Condição (perfeito/danificado/quebrado/faltando_peca/em_manutencao), Responsável recebimento, Observações.
  - Insere uma linha de `pat_movimentacoes` por item devolvido com `tipo='devolucao'` e `saida_origem_id` apontando para a linha da saída original.
- Quando todas as linhas de uma saída estiverem 100% devolvidas, atualizar `saida_status='finalizada'`; parciais ficam `parcialmente_devolvida`.

**Migration nova** (`pat_movimentacoes`):
- `ADD COLUMN requisicao_numero integer` + sequence `pat_requisicao_numero_seq` + função `next_pat_requisicao_numero()`.
- Status de saída via texto livre já existente (`saida_status`), sem novo tipo.

## 3) Estoque — Saídas: usar combobox da planilha no Evento/Projeto + copy on hover

- Em `src/routes/saidas.tsx` (componente `SaidaForm`), substituir o `ComboboxCreatable` + botão de refresh atual pelo `EventoSheetCombobox` (mesmo componente já usado em Patrimônio/Financeiro), removendo as props `eventos`, `eventosError`, `onReloadEventos`, `reloadingEventos` que ficam obsoletas para esse campo.
- Em `src/components/EventoSheetCombobox.tsx`: adicionar, em cada linha do dropdown, um pequeno botão **Copiar** (ícone `Copy`) que aparece on hover (`opacity-0 group-hover:opacity-100`), usa `navigator.clipboard.writeText(r.id)` e mostra toast "Nome copiado". Texto da linha continua `select-text` (já está) e o clique principal continua selecionando o evento.

## Arquivos afetados

- Migration: nova coluna + sequence + função em `pat_movimentacoes`.
- `src/components/patrimonio/Movimentacoes.tsx` — dialog maior, multi-itens, tabela com REQ + expand de códigos.
- `src/components/patrimonio/Devolucoes.tsx` — novo.
- `src/routes/patrimonio.devolucoes.tsx` — novo.
- `src/components/AppSidebar.tsx` — adicionar item "Devoluções" no grupo Patrimônio.
- `src/components/EventoSheetCombobox.tsx` — botão copiar on hover.
- `src/routes/saidas.tsx` — trocar combobox de Evento/Projeto pelo `EventoSheetCombobox`.

## Detalhes técnicos

- Reuso máximo: `ItemSearchSelect`, `ComboboxCreatable`, `EventoSheetCombobox`, `useBulkSelection`, `PeriodoFilter`, `SortableTh`.
- Sem mexer em `src/integrations/supabase/{client,types}.ts`.
- Comunicação com a planilha continua via `listEventos` (`src/server/sheets.functions.ts`), sem mudanças.
