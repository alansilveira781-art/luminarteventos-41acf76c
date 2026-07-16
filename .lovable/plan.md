## 1. Campo Evento / Projeto nos itens da compra

No `CompraDialog` (aba **Itens**), substituir o input+datalist atual do campo "Evento / Projeto" por:

- Um toggle por item: **"É para um evento?"** (Sim / Não), default Sim.
- **Se Sim:** renderizar `EventoSheetCombobox` (mesmo componente já usado em outras telas — lê a planilha do Google Sheets e o calendário, mostra ID + nome + local + produtor, permite busca). O valor selecionado (ID do evento) é salvo em `evento_projeto`.
- **Se Não:** o combobox some e aparece um `Input` livre para digitação (ex.: "Manutenção Galpão", "Uso interno"). O texto é salvo em `evento_projeto`.

O toggle é apenas de UI (para escolher qual campo mostrar) — não precisa nova coluna no banco. Ao abrir um item existente, decidimos o modo automaticamente: se `evento_projeto` bate com algum ID da planilha/calendário → modo Evento; caso contrário → modo Livre.

Remover a lista fixa `EVENTOS_FIXOS` e o datalist antigo.

## 2. Admin master ignora todas as regras

Hoje algumas restrições ainda atingem o admin global no diálogo de edição:

- O `<Select>` de Status usa `disabled={!!compraId || !canEdit}` — ou seja, mesmo admin não muda status pelo dropdown depois de criado. Ajustar para: se `isGlobalAdmin` (admin master), o Select fica sempre habilitado e mostra **todos** os status (inclusive negada e voltar para trás).
- Confirmar que `canEditCompra`, `canDeleteCompra` e `canMoveCompra` já retornam `true` para admin (retornam) — não mexer nessas.
- O botão "Avançar / Aprovar / Reprovar" no rodapé: para admin, ignorar bloqueios de responsável (já ocorre via `canMoveCompra`, mas garantir que a mensagem/tooltip não confunda).

Escopo: apenas admin master (`isGlobalAdmin` do `useAuth`). "Admin do módulo compras" continua com as regras atuais.

## 3. Bloqueio de movimentação (drag + botão lateral)

Sintoma: mesmo quem não é o responsável consegue arrastar o card ou clicar no `ChevronRight` para avançar.

Causa: na função `canMoveCompra` (src/lib/compras.ts), quando **nem** o status de origem **nem** o de destino têm responsável configurado, cai no `canEditCompra`, que retorna `true` para cards legados sem `responsavel_id` e sem `created_by`. Isso libera qualquer usuário.

Ajustes:

- Em `canMoveCompra`: se existe **qualquer** `statusResponsavelId` (destino ou origem), só permitir quem é resp. de origem, resp. de destino, criador ou admin — **nunca** cair no fallback permissivo.
- Se nenhum status tem responsável configurado, manter regra atual (fallback em `canEdit`), mas remover a "porta dos fundos" `if (!responsavel_id && !created_by) return true` do `canEditCompra` **para efeito de movimentação** (mantendo apenas para edição de dados legados) — extrair um helper `canEditFieldsCompra` vs `canMoveCompraFallback`.
- Em `compras.index.tsx` (Card + drag handle): já usa `canMove` para desabilitar. Após a correção acima, o botão lateral e o handle "⋮⋮" ficarão realmente cinzas para quem não pode mover. Nada mais a mudar no componente Card.
- Verificação: com o Pedro logado num card em "análise", o botão avança normalmente (regra Pedro). Com um usuário aleatório logado, botão lateral e drag ficam desabilitados com tooltip "Apenas <fulano> pode mover…".

## Detalhes técnicos (para quem for revisar o código)

Arquivos a editar:

- `src/components/CompraDialog.tsx`
  - novo estado local por item (ou derivado): `modoEvento[idx]: "evento" | "livre"`
  - trocar bloco do datalist (linhas 621‑634) pela renderização condicional (`EventoSheetCombobox` ou `Input`)
  - remover import/uso de `EVENTOS_FIXOS`, `listEventos`, `eventosOptions` (o combobox já busca sozinho)
  - `<Select>` de Status (linha 364): `disabled={!isGlobalAdmin && (!!compraId || !canEdit)}`; `statusOptions` também: se `isGlobalAdmin`, retornar `COMPRA_STATUSES` inteiro
- `src/lib/compras.ts`
  - endurecer `canMoveCompra` conforme descrito
- `src/routes/compras.index.tsx`
  - nenhuma mudança estrutural — `canMove` já é aplicado ao drag handle e ao `ChevronRight`

Fora de escopo: schema do banco, permissões RLS, tela pública, notificações.
