# Integração Clicksign no módulo Jurídico

Automatizar o envio para assinatura: ao mover um contrato para a coluna **Assinatura**, o sistema gera o PDF do contrato, cria o documento no Clicksign, cadastra os signatários e dispara os e-mails de assinatura. Quando o cliente conclui a assinatura, o card fica **amarelo** na própria coluna Assinatura, com o **PDF assinado já anexado** e um botão **Validar**.

## Como vai funcionar no dia a dia

1. O usuário arrasta o card para **Assinatura**.
2. Abre um diálogo de confirmação mostrando os signatários detectados:
   - Cliente (ou representante legal, quando PJ)
   - Representante da Luminart (contratada)
   - Testemunhas cadastradas no contrato
   O usuário pode corrigir nome/e-mail antes de enviar.
3. Ao confirmar: o PDF é gerado a partir do contrato (mesmo conteúdo da impressão atual), enviado ao Clicksign, os signatários são criados e as solicitações de assinatura são disparadas por e-mail.
4. O card passa a exibir o status do envio: "Aguardando assinatura — 1 de 4 assinaram", com data do envio e link para acompanhar.
5. Quando **todos** assinam, o Clicksign avisa o sistema automaticamente: o card fica **amarelo**, o PDF assinado é baixado e anexado ao card (tipo "contrato assinado"), e aparece o botão **Validar**, que segue o fluxo normal para Concluído.
6. Se alguém recusar ou o envio falhar, o card mostra o motivo em vermelho, com opção de reenviar.

## O que preciso de você

- **Token da API do Clicksign (sandbox)** — em Configurações → API na conta sandbox (sandbox.clicksign.com). Vou pedir por um formulário seguro depois que a estrutura estiver pronta.
- **Chave (HMAC) do webhook** — você cria uma senha forte, cola no painel do Clicksign junto com a URL do webhook que eu vou te passar, e salva a mesma no formulário seguro.
- **Nome e e-mail do representante da Luminart** que assina como contratada (posso deixar configurável por empresa).

Começamos em sandbox; a troca para produção depois é só atualizar o token e a URL base.

## Detalhes técnicos

**Banco (nova migração)**
- Novas colunas em `juridico_contratos`: `clicksign_document_key`, `clicksign_envelope_id`, `clicksign_status` (`nao_enviado | enviado | parcial | assinado | recusado | erro`), `clicksign_enviado_em`, `clicksign_assinado_em`, `clicksign_erro`.
- Nova tabela `juridico_assinaturas` (contrato_id, nome, email, documento, papel `cliente|contratada|testemunha`, `signer_key`, `status`, `assinado_em`) com GRANTs + RLS espelhando as políticas atuais de `juridico_contratos`.

**Servidor**
- `src/lib/juridico/clicksign.server.ts`: cliente da API (base sandbox/produção por env), criar documento (upload base64 do PDF), criar signatários, vincular, disparar notificação, baixar documento assinado.
- `src/lib/juridico/clicksign.functions.ts`: `enviarParaAssinatura` e `reenviarAssinatura` com `requireSupabaseAuth`.
- `src/routes/api/public/clicksign-webhook.ts`: valida HMAC-SHA256 do corpo bruto, trata eventos `sign`, `auto_close`/`document_closed` e `refusal`; ao fechar, baixa o PDF assinado, sobe no bucket `juridico-anexos` e insere em `juridico_anexos` (tipo `contrato_assinado`), atualiza status e registra em `juridico_historico`.
- Geração do PDF do contrato no servidor a partir de `corpo_html` (mesmo pipeline de impressão já usado no módulo).

**Frontend**
- `EnviarAssinaturaDialog.tsx`: revisão/edição dos signatários antes do envio.
- `src/routes/juridico.index.tsx`: intercepta o drop na coluna `assinatura` para abrir o diálogo; card com destaque amarelo e botão **Validar** quando `clicksign_status = 'assinado'`; badge de progresso das assinaturas; realtime para atualizar o card assim que o webhook processa.

**Segredos**: `CLICKSIGN_API_TOKEN`, `CLICKSIGN_WEBHOOK_SECRET`, `CLICKSIGN_BASE_URL` (sandbox por padrão).
