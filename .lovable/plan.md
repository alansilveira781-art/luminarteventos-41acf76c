## Objetivo

Adicionar o campo **Código** (numérico, sem letras — coluna `cod` de `pat_itens`) em cada linha do bloco "Itens a patrimoniar" da tela `patrimonio/a-receber`. Hoje esse código é preenchido manualmente no cadastro normal de patrimônio, mas está faltando no fluxo de validação do recebimento — o `id_item` (IMO-####) continua sendo gerado automaticamente.

## Escopo

Arquivo único: `src/routes/patrimonio.a-receber.tsx`.

## Alterações

1. **Tipo `LinhaPat`**: adicionar `cod: number | null`.
2. **`buildInitialLinhas`**: inicializar `cod: null` em cada linha (tanto no caso sem itens quanto no map de `demanda.itens`).
3. **UI (bloco "Itens a patrimoniar")**: adicionar um campo `Código` (input numérico, opcional) ao lado dos outros campos da linha — usando `NumberInput` com precisão 0, placeholder tipo "Ex: 1234".
4. **Insert em `pat_itens`**: incluir `cod: l.cod` (ou `null` se vazio) no payload da mutation `finalizar`.

## Fora de escopo

- `id_item` continua sendo gerado como `IMO-####` sequencialmente (comportamento atual).
- Nenhuma mudança de schema — a coluna `cod` já existe em `pat_itens`.
- Nenhuma validação de unicidade do `cod` (segue o padrão do cadastro atual em `patrimonio.index.tsx`).