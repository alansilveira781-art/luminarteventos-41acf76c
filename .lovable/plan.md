
## Objetivo
No diálogo "Novo/Editar evento" (`src/routes/eventos.index.tsx`), trocar os campos livres de Cidade por listas suspensas pesquisáveis com todos os estados e municípios do Brasil (dados oficiais do IBGE), preenchendo o estado automaticamente ao escolher a cidade.

## Mudanças

### 1. Nova coluna `uf` na tabela `eventos`
Migração adicionando `uf text` (2 letras) em `public.eventos`. Sem obrigatoriedade (para não quebrar registros existentes). Nada mais é alterado no schema.

### 2. Fonte de dados dos municípios
Usar a API pública do IBGE (sem chave, sem custo):
- Estados: `https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome`
- Municípios: `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`

Carregados via `useQuery` com `staleTime: Infinity` (dados praticamente imutáveis, cache durante toda a sessão). Uma única requisição de municípios (~5.500 itens, leve).

Fallback: se a API falhar, os campos voltam a ser inputs de texto livres para não travar o cadastro.

### 3. UI no `EventoDialog`
Substituir os dois `<Input>` atuais de "Cidade" e (novo) "UF" por dois selects pesquisáveis usando o componente já existente no projeto `SearchableSelect` (`src/components/SearchableSelect.tsx`), mantendo o visual consistente:

- **UF**: lista com as 27 unidades federativas (sigla + nome).
- **Cidade**: lista filtrada pela UF selecionada; se nenhuma UF estiver escolhida, mostra todas as cidades com sufixo " - UF" para desambiguar homônimos.

Comportamento:
- Selecionar uma **cidade** preenche automaticamente a **UF** correspondente.
- Selecionar/trocar a **UF** filtra a lista de cidades; se a cidade atual não pertence à nova UF, o campo cidade é limpo.

### 4. Persistência
O `payload` de insert/update passa a incluir `cidade` (nome do município) e `uf` (sigla). Nenhuma outra lógica do formulário muda.

## Fora de escopo
- Não alterar o calendário público, o Gantt, nem outras telas.
- Não migrar dados históricos (registros antigos ficam com `uf` nulo até serem reeditados).
- Não adicionar cadastro manual de cidades — apenas a lista oficial do IBGE.

## Arquivos afetados
- `supabase/migrations/<nova>.sql` — adiciona coluna `uf`.
- `src/routes/eventos.index.tsx` — troca inputs por selects e ajusta payload.
- (opcional) `src/lib/ibge.ts` — helper para buscar estados/municípios via `useQuery`.
