# Campos automáticos do representante legal nos modelos

Na lista de "Campos automáticos" do editor de modelos hoje só aparecem o nome e o CPF dos representantes legais. Os dados de endereço, e-mail e telefone já são capturados no formulário e já existem como variáveis internas, mas não têm botão para inserir no contrato.

## O que muda

Adicionar botões de campo automático para:

- Endereço do representante legal
- E-mail do representante legal
- Telefone do representante legal
- Endereço do 2º representante legal
- E-mail do 2º representante legal
- Telefone do 2º representante legal

Também adicionar os campos de e-mail/documento das testemunhas apenas se necessário — fora do escopo por ora.

## Detalhes técnicos

Em `src/lib/juridico/modelo-render.ts`, incluir na lista `CAMPOS_SUGERIDOS`, logo após os campos de CPF de cada representante, as entradas:

- `resp_legal_endereco`, `resp_legal_email`, `resp_legal_telefone`
- `resp_legal2_endereco`, `resp_legal2_email`, `resp_legal2_telefone`

As variáveis correspondentes já são geradas em `variaveisDoContrato` (endereço montado por `enderecoLinha` com logradouro, número, complemento, bairro, cidade/UF e CEP), então nenhuma alteração de dados ou banco é necessária.
