# Ajustes no módulo Comercial/Vendas

## Objetivo
Aplicar dois ajustes solicitados na área de vendas do comercial:
1. Disponibilizar "Planejados" como opção no filtro de **Classificação**.
2. Ordenar os rankings do **Relatório de Vendas por Período** do maior para o menor, considerando exclusivamente o **Período A**.

## Escopo

### 1. Classificação "Planejados"
- Adicionar o valor fixo **"Planejados"** à lista de opções do filtro de classificação em `src/routes/comercial.vendas.tsx`, garantindo que apareça mesmo quando ainda não houver vendas cadastradas com essa classificação.
- Inserir o registro **"Planejados"** na tabela `comercial_classificacoes` via migração SQL, para que também possa ser selecionado no formulário de cadastro/edição de vendas (`CadastroCombobox`).
- Garantir que o filtro funcione corretamente: ao selecionar "Planejados", exibir apenas vendas com essa classificação; ao selecionar outra classificação do banco, manter o comportamento atual.

### 2. Ordenação do Relatório por Período A
- Em `src/components/comercial/RelatorioVendasPeriodo.tsx`, alterar a função `combinaRanking` para ordenar os itens de forma decrescente pelo valor do **Período A** (`b.A - a.A`).
- Manter a mesma estrutura de dados e exibição; apenas a ordem dos rankings (Categoria, Vendedores, Cerimonial, Decorador) será alterada.

## Arquivos envolvidos
- `src/routes/comercial.vendas.tsx`
- `src/components/comercial/RelatorioVendasPeriodo.tsx`
- Nova migração SQL para inserir "Planejados" em `comercial_classificacoes`

## Critérios de aceitação
- O filtro de classificação em Vendas exibe "Planejados" como opção selecionável.
- O cadastro/edição de vendas permite escolher "Planejados" como classificação.
- Os rankings do Relatório de Vendas por Período são ordenados do maior para o menor pelo valor do Período A.
