## 1. Corrigir o "Something went wrong" em Entradas (e prevenir nas outras)

**Causa raiz**: `usePersistedState` salva o filtro `periodo` no `localStorage` via `JSON.stringify`. Mas `Periodo = { from: Date | null; to: Date | null }` — depois do `JSON.parse` na hidratação, `from`/`to` voltam como **string**, não `Date`. Quando o código chama `periodo.from.getTime()` ou `.toISOString()` nas queries, dispara erro que cai no boundary do TanStack Router.

**Correção**: parar de persistir filtros em `localStorage`. O próprio usuário pediu que filtros sejam lembrados **apenas enquanto a aba estiver aberta** — quando sair e voltar, devem ser limpos. Isso é exatamente o comportamento natural de `useState`, já que o componente da rota desmonta ao trocar de página.

- Trocar todos os `usePersistedState(...)` por `useState(...)` em:
  - `src/routes/entradas.tsx`
  - `src/routes/saidas.tsx`
  - `src/routes/devolucoes.tsx`
  - `src/routes/patrimonio.index.tsx`
  - `src/routes/estoque.index.tsx`
- Remover o import de `usePersistedState` dessas telas (manter o arquivo do hook por enquanto, caso seja útil em outro lugar).

Isso elimina o crash e atende ao requisito de "lembrar só enquanto está na aba".

## 2. Formulários de Entrada e Saída maiores, sem cortar nomes

- Aumentar os diálogos de **Nova/Editar entrada** e **Nova/Editar saída** para `max-w-[min(1400px,98vw)] w-[98vw]` (hoje são `max-w-4xl` / `1200px`).
- No seletor de item (`ItemSearchSelect`) e nos resumos de linha do formulário: remover `truncate` do nome do item e permitir quebra (`whitespace-normal break-words`). O código do item continua em mono, o nome aparece inteiro.
- Garantir que a coluna de item da tabela do formulário use largura flexível para não cortar.

## 3. Mostrar itens zerados no formulário de Entrada e Saída

- Em `src/routes/saidas.tsx` (~linha 188), remover o filtro `.filter((i) => Number(i.quantidade_atual) > 0)` da query de itens do formulário. Todos os itens passam a aparecer na busca.
- Em `src/routes/entradas.tsx`, conferir e garantir o mesmo (entrada já deve listar tudo, mas validar).
- Manter a validação de estoque insuficiente no submit da saída (apenas a listagem passa a incluir zerados).

## 4. Acelerar o lançamento

Hoje o `handleSubmit` faz, para cada linha do lançamento, um `select quantidade_atual` seguido de um `update`, em **sequência**. Com várias linhas isso fica lento.

- Substituir o loop por:
  1. Um único `select id, quantidade_atual` com `.in("id", itemIds)` para todos os itens da movimentação.
  2. Calcular em memória os novos saldos (somando entradas / subtraindo saídas e respeitando linhas duplicadas do mesmo item).
  3. Disparar os `update` em paralelo com `Promise.all` (um por item).
  4. Inserir as movimentações com um único `insert([...])` em lote (já é o caso em parte).
- Aplicar o mesmo padrão em `entradas.tsx` e `saidas.tsx` (criação, edição e duplicação).
- Manter as invalidações de cache atuais ao final.

## 5. Verificação

1. Abrir `/entradas` e `/saidas` e confirmar que a tela carrega sem o erro vermelho.
2. Aplicar filtros, navegar para outra aba e voltar — filtros devem estar limpos.
3. Abrir "Nova entrada" e "Nova saída": diálogos mais largos, nomes longos visíveis por inteiro.
4. Confirmar que itens com estoque zero aparecem no seletor de itens da saída.
5. Criar um lançamento com 5+ linhas e confirmar que salva visivelmente mais rápido.
