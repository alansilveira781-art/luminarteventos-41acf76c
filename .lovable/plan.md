# Lançamento em massa de itens no Patrimônio

Hoje o botão "Novo item" cria um item por vez. A ideia é permitir criar vários itens de uma vez, todos com as mesmas informações (nome, categoria, valor, estado, local, foto etc.), variando apenas o código.

## Como vai funcionar

- No diálogo "Novo item" aparece um botão/chave **"Lançar em massa"** (só na criação, não na edição).
- Ao ativar, o campo **COD** é substituído por um campo de **códigos múltiplos**, onde é possível digitar:
  - lista separada por vírgula ou espaço: `101, 102, 103`
  - intervalos: `101-115`
  - combinação dos dois: `101-105, 120, 131-133`
- Abaixo do campo aparece um resumo: "Serão criados 18 itens (COD 101 a 133)".
- Todos os demais campos do formulário são preenchidos uma única vez e replicados em cada item.
- O botão de ação passa a ser **"Criar 18 itens"**.

## Regras e validações

- Códigos repetidos na própria lista são ignorados (contam uma vez só).
- Antes de gravar, o sistema verifica quais códigos já existem no inventário; se houver conflito, mostra a lista dos códigos duplicados e não grava nada.
- O **ID** de cada item continua sendo gerado automaticamente pela categoria (ex.: `IMO-0042`, `IMO-0043`, …), em sequência.
- Nome continua obrigatório; se o campo de códigos estiver vazio, o sistema avisa.
- Ao final, mensagem de confirmação com a quantidade criada e a lista atualiza automaticamente.

## Detalhes técnicos

- Arquivo: `src/routes/patrimonio.index.tsx`.
- `ItemDialog`: novo estado `bulk` + campo `codsText`, com um utilitário `parseCods(text)` que expande listas/intervalos e retorna números únicos ordenados.
- `saveMut` ganha um caminho de criação em lote: uma consulta `in("cod", cods)` para checar duplicidade, geração sequencial de `id_item` a partir do último existente do prefixo da categoria, e um único `insert` com o array de linhas.
- Os fluxos existentes de item único e de edição permanecem inalterados.
