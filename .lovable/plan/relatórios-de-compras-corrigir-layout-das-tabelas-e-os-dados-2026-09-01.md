# Relatórios de Compras — corrigir layout das tabelas e os dados exibidos

## 1. Colunas sobrepostas (layout)

Hoje as tabelas usam largura percentual fixa, então em telas menores os títulos se espremem e ficam um por cima do outro (como na imagem enviada).

Correção nas três abas (Importação Conta Azul, Cartões e Análises):

- Cada coluna passa a ter uma largura mínima legível em pixels; quando não couber, a tabela rola na horizontal dentro do quadro (rolagem horizontal, conforme escolhido).
- Cabeçalho fixo no topo ao rolar.
- Títulos deixam de se sobrepor: cada célula do cabeçalho respeita sua coluna e trunca com reticências quando necessário (texto completo no hover).
- Altura de linha continua estável, e o seletor de Categoria ganha espaço suficiente para não espremer as colunas vizinhas.

## 2. Informações erradas

Verificação feita nos dados: o cadastro usado hoje para buscar o CNPJ/CPF (**Fornecedores de Compras**) está com o campo documento **vazio em todos os 269 registros**, enquanto o cadastro geral de **Fornecedores** tem documento em 696 de 704. Por isso a coluna CNPJ/CPF aparece quase sempre vazia ou incoerente.

Ajustes:

- **CNPJ/CPF**: passa a ser buscado em cascata — documento gravado no próprio card → cadastro geral de Fornecedores (por vínculo, e quando não houver vínculo, por nome/nome fantasia) → cadastro de fornecedores de compras. Vale para a Importação Conta Azul, para a aba Análises e para as exportações.
- **Cliente/Fornecedor**: quando o card só tem vínculo (sem nome digitado), usa o nome do cadastro.
- **Condição e Parcelamento (Análises)**: hoje o parcelamento pega apenas a primeira forma de pagamento e a condição fica em branco quando não preenchida no card. Passa a consolidar todas as formas/parcelamentos do card e, na falta da condição, usa a condição derivada dos pagamentos (ex.: "À vista" para 1x).
- **Valor**: na Análises, o valor do fornecedor passa a somar os pagamentos do card quando existirem, com fallback para o valor total — evitando divergência com a aba Cartões.

Depois do ajuste vou conferir na tela algumas linhas contra o banco e reportar o que continuar divergente (há cards realmente sem documento cadastrado, e esses seguirão com "—").

## Detalhes técnicos

- `src/routes/compras.relatorios.tsx`: substituir `colgroup` percentual por `min-w-[...]` por coluna + `min-w-max` na tabela dentro do container `overflow-auto`; `thead` com `sticky top-0`.
- Mesma abordagem em `src/components/compras/CartoesReport.tsx` e `src/components/compras/AnalisesFornecedorReport.tsx`.
- Nova função utilitária de resolução de fornecedor/documento (cascata card → `fornecedores` por `id` e por `lower(btrim(nome))`/`nome_fantasia` → `compras_fornecedores`), usada pelas duas abas; carregar `fornecedores` via `fetchAllRows`.
- Consolidação de formas/parcelamento/condição no agregador de `src/lib/compras/analises-fornecedor.ts` (soma de `compra_pagamentos`/`demanda_pagamentos` por card).
