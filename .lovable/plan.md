# Compras: atalho do Natanael e ações em massa no quadro

## 1. Natanael pode finalizar direto

Hoje o card em "Compra Em Andamento" só pode ir para "Compras a Receber" (regra na tela e no banco). Passa a existir um atalho: o Natanael (e apenas ele, além dos administradores) pode mover de **Compra Em Andamento → Finalizado**, pulando "Compras a Receber". O fluxo normal Em Andamento → A Receber continua igual para todos.

Nada muda para os demais usuários, nem para as outras colunas.

## 2. Seleção múltipla de cards

Cada card do quadro ganha um checkbox no canto. Ao marcar um ou mais cards, aparece uma barra no topo com:

- contagem de selecionados
- seletor de coluna de destino + botão **Mover selecionados**
- botão **Aprovar selecionados** (aparece quando todos os marcados estão em "Pendente Aprovação"), que move todos para "Compras Aprovada"
- botão **Limpar**

Regras:

- A permissão é verificada card a card, com as mesmas regras de hoje. Cards sem permissão para aquele destino são pulados e o resultado final mostra "X movidos, Y bloqueados".
- As validações já existentes continuam valendo por card (itens com Evento/Projeto para Pendente Aprovação; tipo de compra, NF e empresa faturada para A Receber). Card que não passa na validação é contado como bloqueado, com o motivo no aviso.
- O responsável padrão do status de destino é aplicado e notificado como já acontece hoje. Quando o destino não tem responsável configurado, o movimento em massa segue sem abrir o diálogo individual de responsável.
- A seleção é limpa ao final e o quadro é recarregado.

Clicar no card continua abrindo o cadastro; o clique no checkbox não abre o card.

## Detalhes técnicos

- `src/lib/compras.ts`: nova constante `NATANAEL_EMAIL` e liberação em `canMoveCompra` do par `em_andamento → finalizado` quando o e-mail do usuário for o do Natanael. `nextCompraStatus` fica intacto; o atalho é tratado como caso extra (semelhante a `isCompraBackMove`).
- Migração em `public.validate_compra_status_transition()`: antes da checagem de `v_next_status`, `RETURN NEW` quando `OLD.status = 'em_andamento'`, `NEW.status = 'finalizado'` e o `auth.uid()` corresponder ao perfil com e-mail `natanael@luminarteventos.com.br`.
- `src/routes/compras.index.tsx`:
  - estado `selectedIds: Set<string>` + `useBulkSelection`-like; `Card` recebe `selected`/`onToggleSelect` e renderiza `Checkbox` (com `stopPropagation` e sem ativar o drag).
  - barra de ações acima do board (só quando `selectedIds.size > 0`) com `Select` de status destino e botões Mover / Aprovar / Limpar.
  - `advanceToStatus` refatorado para retornar `{ ok: boolean; motivo?: string }` (hoje retorna `void`), permitindo o loop em massa contabilizar sucessos/bloqueios; ações em massa chamam com `force: true` para não abrir o diálogo de responsável por card.
  - no card `Avançar` de "Em Andamento", quando o usuário for o Natanael, o botão continua apontando para A Receber; Finalizado é alcançável pelo arraste e pela ação em massa.
