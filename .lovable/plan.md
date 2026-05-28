
## Objetivo
1. Alinhar corretamente os formulários de **Saída** e **Devolução** do módulo Patrimônio.
2. Tratar o cadastro como item-a-item (cada peça é uma linha em `pat_itens`), mas agrupar visualmente itens iguais (mesmo nome + especificação + dimensões + unidade + categoria) e mostrar quantidades por estado ao dar saída.

---

## 1) Layout dos formulários

### Saída (`Movimentacoes.tsx` — `MovForm`)
- Substituir o grid `grid-cols-12` (8/3/1) das linhas de item por um layout que **não desalinhe** quando o label do Item tem o ícone "olho" e o de Quantidade não:
  - Linha = `flex` horizontal: **Grupo de item** (flex-1, mín. 0), **Qtd** (w-28), **botão lixeira** (w-9), todos com `items-end` e label de mesma altura.
- Header dos campos (Data, Responsável, Evento/Projeto, Finalidade, Previsão devolução, Observações) permanece em `grid-cols-2`, mas a previsão de devolução fica `col-span-1` ao lado de um espaço — já cabem 6 campos sem ocupar a linha inteira.
- `DialogContent` já é `max-w-5xl` — mantém.

### Devolução (`Devolucoes.tsx` — `DevolucaoForm`)
- O `SaidaCombobox` selecionado mostra um texto longo que atravessa o card. Ajustes:
  - Card "Itens da requisição" passa a usar a mesma estrutura visual da Saída (tabela `text-xs` com colunas de larguras fixas) dentro de um wrapper `overflow-x-auto`.
  - Inputs de "Devolver agora" com `w-24` à direita; coluna "Item" recebe `min-w-[220px] truncate`.
  - Cabeçalho do grupo selecionado (REQ, data, responsável, evento) renderizado em um bloco próprio acima da tabela, em 2 colunas (`grid grid-cols-2 gap-x-6 gap-y-1 text-xs`) — não mais só dentro do botão do combobox.
- Demais campos (Data, Responsável, Condição, Observações) reorganizados em `grid-cols-2` consistente.

---

## 2) Agrupamento de itens de patrimônio

Modelo de dados **não muda** (continua 1 linha por peça em `pat_itens`). Toda a lógica é em camada de UI/consulta.

### Conceito
Um "grupo de patrimônio" é definido pela chave:
```
normalize(nome) | normalize(especificacao) | normalize(dimensoes) | normalize(unidade) | normalize(categoria) | normalize(subcategoria)
```

### Novo componente `PatGroupSelect.tsx`
Substitui o `ItemSearchSelect` no formulário de Saída do Patrimônio. Mostra cada grupo com:
- Nome + especificação
- `Total: N · Disponíveis: X · Em uso: Y · Danificados/Quebrados/Manutenção: Z`
- Categoria / unidade

Filtra `pat_itens` agrupados em memória; a quantidade "Disponíveis" é calculada como:
```
total_no_grupo  -  (Σ pat_movimentacoes.saida.quantidade onde saida_status ∈ ('aberta','parcialmente_devolvida') e item_id ∈ grupo)
                +  (Σ devoluções já registradas para essas saídas)
```
(reaproveita a query `pat_saidas_abertas` + `pat_devolvido_por_origem` já existentes).
Itens cuja `estado` é `DANIFICADO/QUEBRADO/EM_MANUTENCAO` entram apenas no contador correspondente, não em "Disponíveis".

### Fluxo de saída
- Usuário escolhe **um grupo** e informa **quantidade** (ex.: 5 cadeiras).
- Validação: `quantidade ≤ Disponíveis` no grupo.
- Ao salvar, o sistema **aloca** N peças disponíveis daquele grupo (ordem: `cod` asc, depois `created_at`) e cria N linhas em `pat_movimentacoes` (mesma `requisicao_numero`, `tipo='saida'`, `quantidade=1` por linha) referenciando o `item_id` específico de cada peça.
- Continua sendo possível adicionar **vários grupos** numa mesma requisição (mesmo `addLinha` atual).

### Fluxo de devolução
- Sem mudança estrutural: a devolução continua referenciando `saida_origem_id` (linha individual). A UI agrupa visualmente as peças da requisição por grupo, mostrando "Cadeiras Tiffany — 5 saídas / 2 devolvidas / 3 abertas" e permite digitar quantos voltam; o sistema marca como devolvidas as N peças mais antigas em aberto do grupo.

### Tabela "Saídas" (lista principal)
- A subtabela expandida do grupo de saída passa a mostrar uma linha por **grupo** (não uma por peça): `Grupo · COD/IDs (resumido) · Qtd · UN`. Detalhes individuais (códigos exatos) ficam disponíveis em hover/expand secundário se necessário — opcional, decisão do usuário.

---

## Arquivos afetados
- **Editado**: `src/components/patrimonio/Movimentacoes.tsx` (layout + troca para `PatGroupSelect` + alocação de peças no save).
- **Editado**: `src/components/patrimonio/Devolucoes.tsx` (layout do form e agrupamento visual por grupo).
- **Criado**: `src/components/patrimonio/PatGroupSelect.tsx` (combobox por grupo com totais por estado).
- **Reuso**: `PatItemInfoHover` para visualizar peças individuais ao expandir um grupo.

Sem migrações de banco — toda lógica é client-side sobre `pat_itens` + `pat_movimentacoes`.

---

## Pergunta antes de implementar
Confirma que ao dar saída de "5 cadeiras Tiffany" o sistema deve **escolher automaticamente 5 peças disponíveis** (você não precisa apontar os COD específicos), correto? Ou prefere ver/escolher os COD individuais que sairão?
