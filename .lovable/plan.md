# Evento / Projeto no formulário público de solicitação

## O que muda

No passo **Detalhes da solicitação** do formulário `/solicitar`, cada item passa a ter o campo **Evento / Projeto**, no mesmo padrão já usado no cadastro interno de compras:

- Um seletor **"É para um evento?" (Sim / Não)**.
- Com **Sim**: lista de busca com os eventos do calendário (e da planilha), mostrando código, local, período e produtor — a pessoa escolhe da lista, sem digitar livre.
- Com **Não**: campo de texto livre (ex.: "Manutenção do galpão, uso interno").

O evento escolhido é gravado no item da solicitação e aparece no card de Compras/Despesas como já acontece hoje nos lançamentos internos.

## Detalhes técnicos

- Novo endpoint público `src/routes/api/public/eventos.ts` (GET) que devolve a lista unificada de eventos: linhas raiz de `eventos` (com `codigo_evento`) via `supabaseAdmin`, mais as linhas da planilha (`listEventos`), deduplicadas por código. O formulário é anônimo, então não pode usar o combobox atual, que consulta o banco pelo cliente autenticado.
- Novo componente `src/components/EventoPublicCombobox.tsx`: mesma UX de busca/seleção do `EventoSheetCombobox`, mas alimentado pelo endpoint público (sem `supabase` no cliente).
- `src/routes/solicitar.tsx`: `ItemRow` ganha `evento_projeto: string | null` e `evento_livre: boolean`; a UI de cada item recebe o bloco Sim/Não + combobox/input; o rascunho em `localStorage` continua funcionando (campo novo com default).
- `src/routes/api/public/solicitar.ts`: `itemSchema` ganha `evento_projeto` (string opcional, máx. 200) e o insert em `compra_itens` passa a gravá-lo.
- `demanda_itens` não tem a coluna `evento_projeto`; migração adicionando `evento_projeto text` nessa tabela, para que despesas enviadas pelo formulário também guardem o evento por item.
