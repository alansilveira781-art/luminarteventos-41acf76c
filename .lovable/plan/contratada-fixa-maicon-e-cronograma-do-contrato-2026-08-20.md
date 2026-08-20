# Contratada fixa (Maicon) e cronograma do contrato

## 1. Contratada sempre com os dados da Luminart / Maicon

Hoje os campos da contratada dependem de o cadastro da empresa bater com o texto do card; quando não bate, os campos saem vazios.

Passa a existir um bloco fixo usado sempre que o cadastro não tiver o dado:

- Razão social: LUMINART ALUGUEL DE MÁQUINAS E ESTRUTURAS PARA EVENTOS LTDA
- CNPJ: 14.552.439/0001-31 (também corrigido no cadastro da empresa, que hoje está com final 0001-91)
- Endereço: Av. Maestro Lisboa, n.º 2181, Lagoa Redonda, Fortaleza/CE
- Representante: Maicon Viana de Lima — CPF 040.270.053-84
- E-mail: maicon@luminarteventos.com.br
- Telefone: (85) 9.9933-1605

Efeitos:

- Os campos do modelo (`empresa_razao_social`, `empresa_cnpj`, `empresa_endereco`, `empresa_representante`, `empresa_representante_documento`) nunca mais saem em branco; ganham também `empresa_representante_email` e `empresa_representante_telefone`.
- No envio para assinatura, o signatário "Contratada" já vem preenchido com nome, e-mail e CPF do Maicon (ainda editável).

## 2. Cronograma (Montagem / Evento / Desmontagem) igual ao modelo

O texto digitado no modelo perde as quebras e o recuo ao salvar, então o PDF junta tudo num parágrafo só.

Ajustes:

- Preservar no salvamento do modelo as quebras de linha (`<br>`) e o recuo inicial da linha (espaços/`&nbsp;`/tabulação), em vez de colapsar tudo em espaço simples.
- Preservar também o recuo de parágrafo aplicado pelo editor (`margin-left` / `text-indent`).
- No PDF, cada linha do bloco passa a respeitar o recuo digitado e o rótulo em negrito ("Montagem:", "Evento:", "Desmontagem:") vindo do editor, com quebra de linha por item — igual à imagem enviada.
- A prévia em tela recebe o mesmo tratamento para não divergir do PDF.

## Detalhes técnicos

- `src/lib/juridico/modelo-render.ts`: constante `CONTRATADA_PADRAO`, merge com o registro de `admin_empresas` em `variaveisDoContrato`, novas variáveis de e-mail/telefone do representante; em `normalizarHtmlEditor`, manter `<br>`, converter recuo inicial em `&nbsp;` preservados e manter `margin-left`/`text-indent` no `SANITIZE_OPTS`.
- `src/components/juridico/EnviarAssinaturaDialog.tsx`: fallback do signatário contratada para os dados do Maicon quando não houver valor salvo.
- `src/lib/juridico/contrato-pdf.ts`: em `linhasDe`/`textoDaLinha`, medir o recuo inicial de cada linha e aplicá-lo como deslocamento em `escreverLinha`; linhas recuadas não são justificadas.
- Migração corrigindo o CNPJ em `admin_empresas` para 14552439000131 e preenchendo endereço/representante.
- `src/styles.css` (`.contrato-preview`): manter espaços iniciais visíveis nas linhas do cronograma.
