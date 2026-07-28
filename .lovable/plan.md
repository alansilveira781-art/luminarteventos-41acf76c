## Objetivo

Reformular o formulário **Jurídico › Solicitar contrato** (`/juridico/solicitar`) com duas seções de dados obrigatórias, dois anexos obrigatórios, e transformá-lo em página de acesso apenas por link (fora da sidebar).

## 1. Duas seções obrigatórias

**Dados da Empresa** e **Responsável Legal**, cada uma com os mesmos 4 campos, todos obrigatórios:
- Nome (razão social / nome completo)
- CNPJ / CPF
- E-mail
- Telefone

Validação antes do envio: nenhum campo em branco, e-mail em formato válido, documento com quantidade mínima de dígitos. Erros aparecem sob o campo, e o botão só envia quando tudo estiver preenchido.

Os campos atuais continuam: Tipo (Contrato/Aditivo), Empresa do grupo, Objeto/título, Valor, Data de fechamento e Observações.

## 2. Anexos obrigatórios

Dois campos de arquivo, **ambos obrigatórios**:
- **Proposta** (PDF/Word)
- **Cartão CNPJ** (PDF/imagem)

Ao enviar, os arquivos vão para o armazenamento de anexos do Jurídico e ficam vinculados ao card criado, identificados como "proposta" e "cartão CNPJ" — aparecendo normalmente na aba de anexos do contrato no quadro.

## 3. Acesso por link

O item "Solicitar contrato" sai da barra lateral. Quem estiver liberado em Jurídico › Configurações continua acessando normalmente pelo endereço direto, que você pode compartilhar. Quem não estiver liberado (ou não estiver logado) continua vendo a mensagem de sem permissão. Na tela de Configurações do Jurídico entra um botão "Copiar link do formulário" para facilitar o compartilhamento.

## Detalhes técnicos

- **Banco**: migração adicionando a `juridico_contratos` as colunas `resp_legal_nome`, `resp_legal_documento`, `resp_legal_email`, `resp_legal_telefone` (texto, opcionais no banco — a obrigatoriedade fica no formulário para não quebrar registros existentes).
- **`src/routes/juridico.solicitar.tsx`**: reestruturação em dois blocos `Card` com título de seção; estado de erros por campo; upload sequencial para o bucket `juridico-anexos` (caminho `{contrato_id}/{timestamp}_{nome}`) e inserção em `juridico_anexos` com `tipo` = `proposta` / `cartao_cnpj`. Se o upload falhar, o card criado é informado com aviso.
- **`src/components/AppSidebar.tsx`**: remoção do item `juridicoSolicitante` e da query `sidebar-juridico-solicitante` que só o alimentava.
- **`src/routes/juridico.configuracoes.tsx`**: adicionar `CopiarLinkButton` com o caminho `/juridico/solicitar`.
- **`src/routes/juridico.index.tsx`**: exibir os dados do responsável legal no detalhe do card (somente leitura).
