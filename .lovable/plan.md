# Ativar a integração Clicksign (sandbox)

Importante: as credenciais foram coladas no chat. Por segurança, considere-as expostas — recomendo **gerar um novo API Token** no painel do Clicksign (Configurações → API) antes de ativar, e trocar o segredo do webhook por um novo valor forte no cadastro do webhook.

## O que será feito

1. Abrir o formulário seguro para salvar as credenciais (nunca no código):
   - `CLICKSIGN_API_TOKEN` — token da conta sandbox
   - `CLICKSIGN_WEBHOOK_SECRET` — o mesmo segredo HMAC cadastrado no webhook do Clicksign
   - `CLICKSIGN_BASE_URL` — `https://sandbox.clicksign.com` (padrão)
2. Conferir que o webhook cadastrado aponta para
   `https://grupoluminart.lovable.app/api/public/clicksign-webhook`
   com HMAC ativo e eventos `sign`, `auto_close`/`document_closed` e `refusal`.
3. Teste ponta a ponta: mover um contrato de teste para a coluna **Assinatura**, confirmar os signatários no diálogo, verificar o disparo dos e-mails e o retorno do webhook.
4. Validar o resultado: card fica **amarelo**, PDF assinado anexado ao card e botão **Validar** disponível.

## Detalhes técnicos

- Segredos gravados via formulário seguro (Edge secrets), lidos dentro dos handlers em `clicksign.server.ts` e no webhook.
- Nenhuma mudança de código é necessária: `src/lib/juridico/clicksign.server.ts`, `clicksign.functions.ts`, `clicksign-sync.server.ts` e `src/routes/api/public/clicksign-webhook.ts` já estão prontos.
- Ajustes só entram se o teste ponta a ponta apontar divergência de payload/eventos do Clicksign.
