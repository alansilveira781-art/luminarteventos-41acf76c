# Contrato: limpeza de campos vazios, bloco de assinaturas e formulário enxuto

## 1. Testemunhas e 2º representante somem quando não existem

Hoje, quando um campo opcional não é preenchido, apenas o marcador (`[testemunha1_nome]`) é apagado — o rótulo em volta fica no documento ("TESTEMUNHA:", "CPF:", "E ... inscrito(a) no CPF: ...").

Nova regra de limpeza aplicada antes de gerar o PDF e na impressão local:

- Se todos os marcadores de um parágrafo/linha ficarem sem valor e o que sobrar for só rótulo/pontuação, a linha inteira é removida (some o bloco "TESTEMUNHA: / CPF:").
- Dentro de um parágrafo com texto válido, a frase que contém apenas marcadores vazios é removida (some "E [representante_legal_2] inscrito(a) no CPF: ... e Telefone: ...", mantendo o restante do parágrafo do CONTRATANTE).
- Espaços duplos e pontuação solta ("., ", " e .") são normalizados após o corte.

## 2. Representante legal obrigatório (apenas o 1º)

- `representante_legal` (nome) e `resp_legal_documento` (CPF) entram na lista de campos obrigatórios: o envio para assinatura é bloqueado se estiverem vazios, com aviso de qual campo falta.
- Todos os campos do 2º representante e das testemunhas continuam opcionais e são simplesmente removidos do texto quando vazios.

## 3. Bloco de assinaturas

O bloco `[assinaturas]` passa a sair assim:

```text
_____________________________________
LUMINART EVENTOS
Nome do representante legal da empresa — CPF

_____________________________________
NOME DO CLIENTE
Nome do representante legal — CPF
```

- Empresa contratada com o representante logo abaixo do nome.
- Cliente com o representante legal abaixo (só aparece se preenchido).
- 2º representante só entra se preenchido.
- Bloco "Testemunhas:" só aparece se houver ao menos uma testemunha com nome.

## 4. Endereço do representante legal sai do formulário

- No formulário público de solicitação de contrato, a seção de endereço do responsável legal (e do 2º responsável) é removida — ficam apenas nome, CPF, telefone e e-mail.
- No detalhe do card no Jurídico, os mesmos campos de endereço do representante são removidos da edição.
- Os campos automáticos "Endereço do representante" e "Endereço do 2º representante" saem da lista de campos sugeridos do editor de modelos.
- As colunas do banco permanecem (dados antigos preservados); apenas deixam de ser exibidas/editadas.

## Detalhes técnicos

- `src/lib/juridico/modelo-render.ts`:
  - nova função de limpeza (recebe html + valores) com corte por linha e por frase, substituindo o uso atual de `limparCamposVazios` no envio e na impressão;
  - `blocoAssinaturas` reescrito conforme o formato acima;
  - `CAMPOS_OBRIGATORIOS` ganha `representante_legal` e `resp_legal_documento`;
  - `CAMPOS_SUGERIDOS` perde `resp_legal_endereco` e `resp_legal2_endereco`.
- `src/components/juridico/EnviarAssinaturaDialog.tsx`: usa a nova limpeza (prévia e PDF idênticos ao enviado).
- `src/routes/solicitar-contrato.tsx` + `src/routes/api/public/solicitar-contrato.ts`: remoção dos blocos/validações de endereço do responsável legal.
- `src/routes/juridico.index.tsx`: remoção dos `EnderecoEditor` dos responsáveis legais e dos respectivos campos no payload de salvar.
- Sem migração de banco.
