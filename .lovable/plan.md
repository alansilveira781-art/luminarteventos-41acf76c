# Jurídico: data automática, parcelas dinâmicas, testemunhas, 2 responsáveis e bloco de assinaturas

## 1. Campo automático de data

Na aba Modelos, os atalhos de "Campos automáticos" passam a incluir:
- **Data de hoje** (`[data_hoje]`) — 06/08/2026
- **Data por extenso** (`[data_extenso]`) — já existe, mantido
- **Data de criação do contrato** (`[data_criacao]` e `[data_criacao_extenso]`) — data em que o card entrou no Jurídico
- **Cidade e data** (`[cidade_data]`) — "Belo Horizonte, 6 de agosto de 2026", para o rodapé antes das assinaturas

## 2. Parcelas acompanham a forma de pagamento

O campo `[parcelas]` passa a gerar uma linha por parcela, no formato numerado:

```text
1ª parcela de R$ 30.200,00 com vencimento em 10/08/2026;
2ª parcela de R$ 30.200,00 com vencimento em 10/09/2026;
```

Se o pagamento tiver 1, 2, 3 ou N parcelas, o texto se ajusta sozinho — e é recalculado sempre que o pagamento é editado no card. Também ficam disponíveis `[forma_pagamento]` (Pix/Boleto) e `[qtd_parcelas]`.

## 3. Testemunhas (até 2) e segundo responsável legal

- **Formulário público de solicitação**: nova seção "Testemunhas (opcional)" com até 2 entradas (nome, CPF, e-mail) e um botão "Adicionar segundo responsável legal" que replica os campos já existentes (nome, CPF, endereço completo, e-mail, telefone).
- **Card no Jurídico**: os mesmos blocos ficam editáveis no detalhe do contrato — adicionar, editar e remover testemunhas e o 2º responsável legal, salvos no botão Salvar.
- Novos campos automáticos: `[testemunha1_nome]`, `[testemunha1_documento]`, `[testemunha2_nome]`, `[testemunha2_documento]`, `[resp_legal2_nome]`, `[resp_legal2_documento]`, `[resp_legal2_endereco]`.

## 4. Bloco de assinaturas

Novo campo automático **`[assinaturas]`** que monta o rodapé no formato da imagem: linha de assinatura, nome em caixa alta e, abaixo, o representante.

```text
_____________________________________
        LUMINART (contratada)
     NOME DO REPRESENTANTE — CPF

_____________________________________
        AXIS REAL ESTATE LTDA
EVANDRO MARCIO SCARPELLI DA COSTA ALONSO

Testemunhas:
_____________________  _____________________
Nome / CPF             Nome / CPF
```

Também ficam disponíveis campos individuais para montar o bloco manualmente no modelo: `[empresa_razao_social]`, `[empresa_cnpj]`, `[empresa_representante]`, `[empresa_representante_documento]`, `[cliente_nome]`, `[representante_legal]`.

## 5. Representante da nossa empresa

Em **Admin > Empresas**, cada empresa ganha os campos **Representante legal** e **CPF do representante**. O contrato usa automaticamente os dados da empresa selecionada no card.

## Detalhes técnicos

- Migração: `admin_empresas` ganha `representante_nome` e `representante_documento`; `juridico_contratos` ganha `testemunhas jsonb` (array de `{nome, documento, email}`) e as colunas `resp_legal2_*` (nome, documento, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf).
- `src/lib/juridico/modelo-render.ts`: novas variáveis (datas, testemunhas, resp_legal2, empresa/representante, `assinaturas`), `parcelasTexto` passa a usar quebras de linha `<br>` numeradas, e `CAMPOS_SUGERIDOS` recebe as novas entradas agrupadas.
- `variaveisDoContrato` passa a receber a empresa resolvida (busca em `admin_empresas` pelo campo `empresa` do contrato) — feita no `DefinirCategoriaDialog` e na regeneração do corpo.
- `src/routes/solicitar-contrato.tsx`: seção de testemunhas e 2º responsável legal, reaproveitando `EnderecoEditor`/helpers de `contrato-form.ts`; validação Zod correspondente em `src/routes/api/public/solicitar-contrato.ts` e persistência dos novos campos.
- `src/routes/juridico.index.tsx`: novos blocos editáveis no detalhe do contrato e inclusão dos campos no payload de `salvar()`.
- `src/routes/admin.empresas.tsx`: dois campos novos no formulário da empresa.
