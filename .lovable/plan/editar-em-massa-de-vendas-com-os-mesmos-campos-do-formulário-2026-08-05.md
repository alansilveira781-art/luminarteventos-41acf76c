# Editar em massa de Vendas com os mesmos campos do formulário

Hoje, na aba Vendas do Comercial, o diálogo "Editar em massa" mostra Consultor, Cerimonial e Decorador como campos de texto livre, enquanto o formulário de Nova Venda usa listas suspensas alimentadas pelos cadastros (Configurações). Isso permite digitar nomes divergentes do cadastro.

## O que muda

- Consultor(a), Cerimonial e Decorador(a)/Agência passam a ser listas suspensas com busca, iguais às do formulário de venda (inclusive com criação de novo cadastro inline).
- Classificação continua como lista, mas passa a usar o mesmo componente de cadastro, ficando idêntica ao formulário.
- Tipo deixa de ser texto livre e vira lista com "Venda" e "Extra".
- Empresa permanece como lista das empresas já existentes.
- Cada campo de cadastro mantém a opção de limpar o valor (deixar em branco nos registros selecionados).
- Valores (Proposta, Desconto, Valor Final, Valor BV) seguem como estão.

## Detalhes técnicos

- `src/components/BulkEditDialog.tsx`: adicionar um novo tipo de campo `cadastro` ao union `BulkField` (`table`, `queryKey`, `extraFields?`, `allowClear?`) e renderizá-lo com `CadastroCombobox`. Incluir, junto ao combobox, um botão "Limpar" que define o valor como `__null__` (já tratado por `normalizeBulkPatch`).
- `src/routes/comercial.vendas.tsx`: em `BULK_FIELDS`, trocar `consultor`, `cerimonial`, `decorador` e `classificacao` para o tipo `cadastro` com as mesmas tabelas/queryKeys/extraFields usados no formulário; trocar `tipo` para `select` com as opções Venda/Extra.
- Nenhuma alteração de banco ou de lógica de gravação: o patch continua enviando o texto do nome, como já ocorre hoje.
