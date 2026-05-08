## Mudanças

### 1. Agrupamento por Requisição de Material (Saídas e Entradas)

Hoje cada item de uma saída/entrada vira uma linha separada na tabela. Quando você lança 5 itens em um único formulário, aparecem 5 linhas idênticas. A proposta é introduzir o **ID da Requisição de Material** (REQ-XX): cada formulário gera **uma** requisição com vários itens, e a tabela mostra **uma linha por requisição**.

#### Banco

Migration nova:
- `CREATE SEQUENCE requisicao_material_seq` (começa em 1).
- `ALTER TABLE movimentacoes ADD COLUMN requisicao_numero INTEGER NULL` + índice `(requisicao_numero, tipo)`.
- Função `next_requisicao_numero()` retornando `nextval(...)::int`.
- **Backfill**: cada linha existente sem número recebe um próprio (lançamentos antigos = requisições de 1 item).

#### Inserção (Saídas e Entradas)

Em `src/routes/saidas.tsx` e `src/routes/entradas.tsx`, no `mut.mutationFn`:
- Buscar o próximo número via `supabase.rpc("next_requisicao_numero")`.
- Aplicar o **mesmo `requisicao_numero`** em todas as linhas do array de inserts.

#### Tabela agrupada

`useMemo` agrupando por `requisicao_numero`. Colunas novas:

- **Saídas**: REQ | Data | Evento/Projeto | Solicitante | Tipo | Itens | Qtd total | Devolver até | Status
- **Entradas**: REQ | Data | Fornecedor | NF | Tipo | Itens | Qtd total | Valor total

A coluna **Item** sai (fica dentro da requisição). REQ aparece como `REQ-042` em fonte mono.

#### Detalhes / Edição / Exclusão / Bulk

- Clique abre `MovimentacaoDetalhesDialog` adaptado para receber as `linhas` da requisição direto.
- **Excluir**: apaga todas as linhas da requisição (e devoluções vinculadas, no caso de saídas).
- **Duplicar**: prefill com todos os itens da requisição.
- **Editar**: formulário grande com metadados + itens carregados (edição da requisição inteira; trigger do banco recalcula estoque por linha).
- **Bulk**: checkbox opera por requisição; aplica em todas as linhas dela.

#### Compatibilidade
Lançamentos antigos viram requisições de 1 item. Dashboard, devoluções e relatórios continuam lendo `movimentacoes` linha-a-linha — sem mudança.

> **Pergunta aberta**: quer também trocar o agrupamento de Devoluções para usar `requisicao_numero` (mais robusto que o atual `data + solicitante + evento`)?

### 2. Evento/Projeto digitável em Compras

No `src/components/CompraDialog.tsx`, o campo **Evento/Projeto** por item hoje é um `Select` fixo (só permite escolher das opções). Vou trocar pelo componente `SelectCreatable` (já existe em `src/components/SelectCreatable.tsx` e é usado em outros lugares do projeto), que:
- Mostra a lista de eventos da planilha do Google Sheets + as 4 opções fixas (Manutenção do Galpão, Reposição de Estoque, Showroom, Placas do Zé).
- Permite **digitar** o nome de um evento/projeto novo direto no campo, e o valor digitado é salvo em `compra_itens.evento_projeto`.
- Mantém busca/filtro nas opções existentes enquanto você digita.

Sem mudanças de banco — a coluna `evento_projeto` já é texto livre.

### Arquivos afetados

- `supabase/migrations/<novo>.sql` — sequence, coluna, função, backfill, índice.
- `src/routes/saidas.tsx` — agrupamento, novas colunas, mutate com `requisicao_numero`, edição/exclusão por requisição.
- `src/routes/entradas.tsx` — idem.
- `src/components/MovimentacaoDetalhesDialog.tsx` — aceitar `linhas` direto.
- `src/components/CompraDialog.tsx` — trocar `Select` de Evento/Projeto por `SelectCreatable`.
- (Opcional) `src/routes/devolucoes.tsx` — agrupar por `requisicao_numero`.
