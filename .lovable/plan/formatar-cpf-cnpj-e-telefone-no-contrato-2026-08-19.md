# Formatar CPF/CNPJ e telefone no contrato

Hoje os documentos e telefones aparecem como números crus (ex.: `07939512323`, `85985039179`). Passarão a ser formatados automaticamente ao render o contrato:

- CPF: `xxx.xxx.xxx-xx`
- CNPJ: `xx.xxx.xxx/xxxx-xx` (detectado por 14 dígitos)
- Telefone: `(xx)x.xxxx-xxxx` para celular e `(xx)xxxx-xxxx` para fixo

Vale tanto no corpo do contrato quanto no bloco de assinaturas (nome do representante — CPF formatado).

Se o valor não tiver a quantidade esperada de dígitos, é mostrado como foi digitado.

## Detalhes técnicos

Em `src/lib/juridico/modelo-render.ts`:
- Adicionar helpers `fmtDoc(v)` e `fmtTel(v)` (apenas dígitos → máscara).
- Aplicar em `variaveisDoContrato` nos campos: `cliente_documento`, `cpf`, `cnpj`, `empresa_cnpj`, `empresa_representante_documento`, `resp_legal_documento`, `resp_legal2_documento`, `testemunha1_documento`, `testemunha2_documento`, e nos telefones `cliente_telefone`, `resp_legal_telefone`, `resp_legal2_telefone`.
- Aplicar `fmtDoc` também em `blocoAssinaturas` (linhas de representante e testemunhas).

Sem mudança de banco ou de formulário: o dado continua sendo salvo como está; a formatação é só na renderização.
