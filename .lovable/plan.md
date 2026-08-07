# Simplificar o formulário público de solicitação de contrato

## O que muda para quem preenche

- **Forma de pagamento sai do formulário**: nada de Pix/Boleto, número de parcelas, datas ou valores de parcela. O valor total do contrato continua sendo informado.
- **Empresa do grupo sai do formulário**.
- Ambas as informações passam a ser preenchidas internamente, no Jurídico, quando o card entra em criação (os editores de pagamento e o campo de empresa já existem no card de detalhe).
- **Anexos**:
  - Pessoa Física: apenas a Proposta (campo de documento com foto removido).
  - Pessoa Jurídica: Proposta + Cartão CNPJ, como hoje.

O restante do formulário (dados do cliente, endereço, responsáveis legais, testemunhas, período do evento, montagem/desmontagem, observações) permanece igual.

## Detalhes técnicos

`src/routes/solicitar-contrato.tsx`
- Remover o bloco "Forma de pagamento" (estados `pagForma`, `pagModo`, `qtdParcelas`, `parcelas`, `valoresCalculados`, `somaParcelas`) e as validações associadas, mantendo apenas a validação de valor total.
- Remover o Select "Empresa do grupo" e o campo `empresa` do estado/payload.
- Anexo secundário passa a ser condicional: só renderiza e só é obrigatório quando `isPJ` (`cartao_cnpj`); em PF nada é enviado.

`src/routes/api/public/solicitar-contrato.ts`
- Tornar `empresa`, `pagamento_forma`, `pagamento_modo` e `pagamento_parcelas` opcionais no schema; gravar vazio/nulo quando ausentes.
- Aceitar envio sem o anexo secundário; manter `cartao_cnpj` para PJ e remover o tratamento de `documento_foto`.

`src/routes/juridico.index.tsx`
- Sem mudança estrutural: o card de detalhe já permite editar empresa, endereço e pagamento. Ajustar apenas o texto de estado vazio da seção de pagamento para indicar que será preenchido internamente.

Sem migração de banco: as colunas continuam existindo e passam a ser preenchidas internamente.
