# Formulário público de contrato: Pessoa Física / Jurídica + pagamento

## O que muda para quem preenche

Ao abrir o link, a primeira escolha passa a ser **Pessoa Física** ou **Pessoa Jurídica**.

**Pessoa Física**
- Nome, CPF, Endereço completo (CEP, logradouro, número, complemento, bairro, cidade, UF), E-mail, Telefone.
- Sem seção de Responsável Legal.
- Anexos obrigatórios: Proposta + Documento com foto (RG/CNH).

**Pessoa Jurídica**
- Razão Social, CNPJ, Endereço completo, E-mail, Telefone.
- Responsável Legal: Nome, CPF, Endereço completo, E-mail, Telefone.
- Anexos obrigatórios: Proposta + Cartão CNPJ (como hoje).

## Forma de pagamento (nos dois fluxos)

- Forma: **Pix** ou **Boleto**.
- Número de parcelas (1 ou mais).
- Se mais de 1 parcela, escolher entre:
  - **Parcelas iguais**: informa só as datas de vencimento de cada parcela; o sistema divide o valor total igualmente (o resíduo de centavos entra na última parcela).
  - **Valores diferentes**: informa data e valor de cada parcela; a soma precisa bater com o valor total (tolerância de R$ 0,01), senão o envio é bloqueado com aviso.
- Com 1 parcela, pede apenas a data de vencimento.
- CEP com busca automática de endereço (ViaCEP), com edição manual permitida.

## Como fica no Jurídico

O card do contrato mostra tipo de pessoa, endereço, forma de pagamento e a tabela de parcelas (nº, vencimento, valor), além dos dados já existentes.

## Detalhes técnicos

**Banco (migração)** — novas colunas em `juridico_contratos`:
- `cliente_tipo text` ('pf' | 'pj'), `cliente_cep`, `cliente_logradouro`, `cliente_numero`, `cliente_complemento`, `cliente_bairro`, `cliente_cidade`, `cliente_uf`
- mesmos campos de endereço para o responsável legal (`resp_legal_*`)
- `pagamento_forma text` ('pix' | 'boleto'), `pagamento_modo text` ('igual' | 'diferente'), `pagamento_parcelas jsonb` (array `{ n, vencimento, valor }`)
- Sem novas tabelas; sem mudança de RLS (grants/policies atuais já cobrem).

**Frontend** — `src/routes/solicitar-contrato.tsx`:
- Estado do formulário reorganizado com `cliente_tipo`; validação condicional (respLegal só em PJ; documento 11 dígitos em PF, 14 em PJ).
- Novo bloco de endereço reutilizável e novo bloco de pagamento com grade de parcelas.
- Anexo dinâmico: `cartao_cnpj` (PJ) ou `documento_foto` (PF).

**Backend** — `src/routes/api/public/solicitar-contrato.ts`:
- Schema Zod com refinamentos por `cliente_tipo` e validação da soma das parcelas.
- Aceita a chave de anexo `documento_foto` além de `proposta`/`cartao_cnpj`, mantendo limite de 10 MB e rate limit.
- Persiste os novos campos e o array de parcelas.

**Exibição interna** — `src/routes/juridico.index.tsx` (dialog de detalhe): seções de endereço, pagamento e parcelas em modo leitura.
