# Jurídico: editar pagamento/endereço, diálogo ao ir para Criação e modelos com [campos]

## 1. Editar forma de pagamento e endereço no card

Hoje o detalhe do contrato só permite editar título, empresa, cliente, documento, e-mail, telefone, responsável, valor, status, datas e observações. Endereço e pagamentos vindos do formulário público são apenas exibidos.

Mudanças na aba "Dados" do detalhe do contrato:
- Bloco **Endereço do cliente** editável: CEP (com busca automática ViaCEP), logradouro, número, complemento, bairro, cidade, UF.
- Bloco **Responsável legal** editável (mesmos campos + nome/CPF/e-mail/telefone), exibido quando o contrato é de pessoa jurídica.
- Bloco **Pagamento** editável: forma (Pix / Boleto), modo (parcelas iguais / valores diferentes), número de parcelas e a grade de parcelas com vencimento e valor por linha, com adicionar/remover linha.
  - No modo "iguais", ao alterar o valor total ou a quantidade, os valores das parcelas são recalculados automaticamente (ajuste de centavos na última).
  - Indicador da soma das parcelas x valor do contrato, alertando quando não bate.
- Todos esses campos passam a ser salvos no botão Salvar.

## 2. Diálogo ao mover o card para "Criação"

Ao arrastar (ou mudar o status) para **Criação**, abre um diálogo antes de confirmar:
- Escolha do tipo do contrato: **Stand, Corporativo, Social ou Cenografia**.
- Lista dos modelos cadastrados daquele tipo, para escolher qual será usado.
- Prévia dos dados que serão aplicados (cliente, documento, endereço, valor, parcelas).
- Ao confirmar: o tipo é gravado no contrato, o corpo do modelo é copiado para o contrato com os campos já preenchidos a partir dos dados existentes, e o card muda para Criação. Cancelar mantém o card na coluna original.
- Em seguida abre o editor do contrato gerado, para revisar/ajustar antes de anexar.

## 3. Modelos com campos entre colchetes `[xxxx]`

Na aba Modelos:
- Passa a reconhecer marcadores no formato `[nome_do_campo]` além do formato atual `{{campo}}` (os modelos existentes continuam funcionando).
- Botão "+ Campo" no editor insere `[nome_do_campo]`, e os marcadores aparecem destacados no corpo.
- Lista de campos automáticos sugeridos (cliente, documento, endereço completo, e-mail, telefone, valor, parcelas, data, representante legal) para inserir com um clique; o que não for automático fica como campo livre a preencher.
- Na geração do contrato (item 2), os marcadores com correspondência nos dados do card são substituídos automaticamente; os demais viram campos de preenchimento no diálogo, e o que ficar em branco permanece como `[campo]` destacado no texto para preenchimento manual depois.

## Detalhes técnicos

- `src/routes/juridico.index.tsx`: ampliar o payload de `salvar()` com `cliente_*` de endereço, `resp_legal_*`, `pagamento_forma`, `pagamento_modo`, `pagamento_parcelas` (jsonb); novo componente `PagamentoEditor` reaproveitando a lógica de parcelas do formulário público; novo `DefinirTipoContratoDialog` acionado em `onDragEnd`/mudança de status para `criacao`.
- Extrair helpers de endereço/ViaCEP e de parcelas de `src/routes/solicitar-contrato.tsx` para `src/lib/juridico/contrato-form.ts` para uso nos dois lugares.
- Novo `src/lib/juridico/modelo-render.ts`: parser de `[campo]` e `{{campo}}`, mapa de variáveis derivadas do contrato e função de substituição sanitizada (DOMPurify, como já é feito hoje).
- `src/routes/juridico.modelos.tsx`: `extractVars` passa a capturar as duas sintaxes; botão de inserir campo grava colchetes.
- Sem mudanças de schema: as colunas de endereço, responsável legal, pagamento, `tipo`, `modelo_id` e `corpo_html` já existem em `juridico_contratos`.
