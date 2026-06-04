## Diagnóstico

A causa raiz é no banco: as **funções** `apply_movement`, `apply_custo_medio_entrada`, `refresh_saida_status`, `apply_movimentacao_item` e `notify_stock_alert` existem, mas **nenhum trigger está conectado** às tabelas `movimentacoes`/`movimentacao_itens`/`itens` (confirmado: `0 rows` em `pg_trigger`).

Consequência:
- Ao registrar uma **entrada**, a linha entra em `movimentacoes`, mas `itens.quantidade_atual` **não é incrementado**. Por isso, ao abrir "Nova saída", o item recém-cadastrado/entrado aparece como **zerado**.
- Ao registrar uma **saída**, o estoque também não é decrementado.
- O custo médio (entrada) e o status da saída (devolvida/parcial) também deixaram de ser atualizados.

Conferência real no banco (entradas recentes):
- SKU-42: entrada de 200 → `quantidade_atual = 200` (coincidência: foi a primeira)
- SKU-94: entrada de 5 → `quantidade_atual = 0` ❌
- SKU-96/97: entrada de 4 → `quantidade_atual = 0` ❌
- código 1957: entrada de 30 → `quantidade_atual = 7` ❌

Além disso, o código de **edição/exclusão** em `entradas.tsx`, `saidas.tsx` e `devolucoes.tsx` faz `UPDATE itens SET quantidade_atual = ...` **manualmente**. Se religarmos os triggers sem mexer no código, edições/exclusões passariam a **dobrar** o ajuste. Precisa ser tratado junto.

## Plano

### 1. Migração: recriar triggers no banco
Em uma única migração:
- `BEFORE INSERT ON movimentacoes` → `apply_movement()` (incrementa/decrementa `itens.quantidade_atual` e define `saida_status='aberta'` em saídas novas).
- `AFTER INSERT ON movimentacoes` → `apply_custo_medio_entrada()` (recalcula custo médio em entradas).
- `AFTER INSERT ON movimentacoes` → `refresh_saida_status()` (marca saída como devolvida/parcialmente_devolvida em devoluções).
- `AFTER INSERT/UPDATE/DELETE ON movimentacao_itens` → `apply_movimentacao_item()` (mesma lógica para movimentações multi‑item).
- `AFTER UPDATE OF status ON itens` → `notify_stock_alert()` (alertas de baixo/sem estoque).
- **Reconciliação one‑shot** no fim da migração: recalcular `itens.quantidade_atual` a partir do somatório de `movimentacoes` (entradas, saídas, devoluções por condição) + `movimentacao_itens`, para corrigir o drift acumulado desde que os triggers sumiram. Em seguida rodar `refresh_item_status` para todos os itens.

### 2. Ajustar `entradas.tsx`, `saidas.tsx`, `devolucoes.tsx`
Remover os blocos manuais que fazem `UPDATE itens SET quantidade_atual = ...` em:
- `editMut` (linhas 71‑84 entradas, 67‑79 saídas)
- `editGroupMut` (entradas 101‑104; saídas 112‑116)
- `delMut` (entradas 134‑140; saídas 145‑154; devoluções ~133)

A lógica passa a ser: validar estoque no client (já existe na saída), em seguida `delete`/`insert`/`update` em `movimentacoes` — os triggers cuidam de `itens.quantidade_atual`. Para **edição** (que hoje é delete+insert no caso de grupos), o novo fluxo continua funcionando: cada delete devolve estoque via trigger e cada insert reaplica.

Para a **edição de linha única** (`editMut`), trocar para o mesmo padrão: deletar o registro antigo (trigger reverte) e inserir o novo (trigger reaplica), ao invés do `update` parcial atual.

### 3. Validação manual após aplicar
- Criar um item novo com quantidade inicial 0.
- Registrar uma entrada de 5 unidades → `itens.quantidade_atual` deve ir para 5.
- Abrir "Nova saída", selecionar o item → deve mostrar 5 disponíveis.
- Registrar saída de 2 → estoque deve ir para 3.
- Editar a saída para 1 → estoque vai para 4.
- Excluir a saída → estoque volta a 5.

### Fora de escopo
- Mudanças no Dashboard, Painel Financeiro ou Conta Azul (continuam como estão).
- Mudanças nos formulários de fornecedor/solicitante (o cadastro já invalida as queries; se ainda houver problema específico após o fix do estoque, tratamos em seguida com um caso reproduzível).
