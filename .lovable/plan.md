# Envio de e-mails para clientes (Comercial)

## Objetivo
Permitir disparar e-mails para clientes diretamente do card no Kanban do Comercial, com suporte a:
- **Envio manual avulso** (você escreve assunto/mensagem na hora)
- **Templates pré-definidos** (envio de proposta, follow-up, agradecimento, cobrança)
- **Automações em eventos** (ex.: ao mover card para "Orçamento Enviado", ao aprovar proposta)
- **PDF da proposta** incluído como link de download seguro no corpo do e-mail

## Pré-requisitos (configuração)
1. **Configurar domínio remetente** na Lovable Cloud (você adiciona registros DNS — eu te entrego o passo a passo no diálogo). Sem isso os e-mails não saem com sua marca.
2. **Infraestrutura de e-mails da Lovable**: fila de envio com retry, logs, supressão de bounces/reclamações e link de unsubscribe automático.

## Funcionalidades

### 1. Botão "Enviar e-mail" no card (Kanban Comercial)
Adicionado no `DetalhesDrawer.tsx` do card. Abre um diálogo com:
- Destinatário pré-preenchido (e-mail do cliente do card)
- Seletor de template: **Personalizado**, **Envio de Proposta**, **Follow-up**, **Agradecimento**, **Cobrança**
- Campos de assunto e mensagem (editáveis — template apenas pré-preenche)
- Checkbox **"Anexar PDF da proposta"** (visível quando o card tem proposta vinculada)
- Histórico de e-mails enviados para aquele card

### 2. PDF da proposta como link de download
Como a Lovable não suporta anexo nativo, o fluxo é:
1. Gerar o PDF da proposta (já existe `src/lib/comercial/pdf.ts`)
2. Subir o PDF em um bucket privado do Storage (`propostas-pdf`)
3. Criar uma URL assinada de 30 dias
4. Incluir o link como botão **"Baixar proposta (PDF)"** no corpo do e-mail

### 3. Templates de e-mail (React Email)
Quatro templates branded com a identidade visual do app:
- `proposta-envio` — envio de proposta com link do PDF e dados do evento
- `proposta-followup` — follow-up de proposta enviada
- `proposta-agradecimento` — agradecimento pós-fechamento
- `proposta-cobranca` — lembrete educado de retorno
- `comercial-personalizado` — template genérico para envios manuais

### 4. Automações opcionais (você liga/desliga)
- Ao mover card para **Orçamento Enviado** → sugere disparar e-mail "Envio de Proposta" (não envia automático, só pré-abre o diálogo, para você revisar antes)
- Ao aprovar proposta → opção de disparar agradecimento

### 5. Histórico de e-mails
Nova aba/sessão no drawer do card listando: data, destinatário, template, assunto, status (enviado / falhou / suprimido), com link para reenvio.

## Detalhes técnicos

### Banco de dados (nova tabela)
- `comercial_email_log` — registro de e-mails enviados por card/proposta:
  - `card_id`, `proposta_id`, `cliente_email`, `template_name`, `subject`, `pdf_url`, `status`, `enviado_por` (user_id)
  - RLS: apenas usuários autenticados com acesso ao módulo Comercial leem/escrevem
  - GRANTs para `authenticated` e `service_role`

### Storage
- Novo bucket privado `propostas-pdf` com policy que restringe leitura via URL assinada
- Path: `{proposta_id}/v{version}-{timestamp}.pdf`

### Infraestrutura de e-mail
- `email_domain--setup_email_infra` + `email_domain--scaffold_transactional_email`
- Server route `/lovable/email/transactional/send` (criado pelo scaffold) — usado por todo envio
- Server function `sendComercialEmail` em `src/lib/comercial/email.functions.ts` que:
  1. Gera PDF (se solicitado), faz upload e gera URL assinada
  2. Chama o template registrado com os dados do card/proposta
  3. Registra em `comercial_email_log`

### Arquivos a criar
- `src/lib/email-templates/proposta-envio.tsx` (+ 3 outros templates)
- `src/lib/email-templates/registry.ts` (atualizado)
- `src/lib/comercial/email.functions.ts` (server functions)
- `src/components/comercial/EnviarEmailDialog.tsx` (diálogo no drawer)
- `src/components/comercial/HistoricoEmails.tsx` (lista no drawer)
- Migration: tabela `comercial_email_log` + bucket `propostas-pdf` + policies

### Arquivos a editar
- `src/components/comercial/DetalhesDrawer.tsx` — botão "Enviar e-mail" + aba histórico
- `src/lib/comercial/store.ts` — helper para buscar e-mails enviados de um card
- `package.json` — adicionar `@react-email/components`, `react-email`, `@lovable.dev/email-js`, `@lovable.dev/webhooks-js`

## Fluxo de aprovação
1. Você aprova este plano
2. Eu rodo a migration (cria tabela + bucket)
3. Eu configuro a infraestrutura de e-mail e abro o diálogo de domínio para você colar os DNS
4. Eu crio os templates, server functions e UI do diálogo
5. Você testa enviando para você mesmo antes de usar com cliente real

## Fora do escopo (não será feito)
- Envio em massa / newsletter / marketing (não permitido pela política de e-mail transacional)
- Editor visual de templates (templates são código com branding fixo; texto/assunto editáveis no envio)
- Recebimento de respostas dentro do app (respostas vão para sua caixa de entrada normal via "Reply-To")