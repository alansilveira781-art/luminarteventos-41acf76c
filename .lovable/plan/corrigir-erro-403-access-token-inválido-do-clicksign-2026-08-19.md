# Corrigir erro 403 "Access Token inválido" do Clicksign

O envio para assinatura está falhando com `Clicksign [403]: {"errors":["Access Token inválido"]}`. Isso vem do próprio Clicksign: a chamada chegou até eles, mas o token não é aceito no ambiente configurado.

## Causa mais provável

Hoje o sistema aponta para o ambiente **sandbox** (`https://sandbox.clicksign.com`) usando a **API v1** (token no formato UUID, enviado como `access_token` na URL).

Um 403 assim acontece quando:

1. O token foi gerado na conta de **produção** (app.clicksign.com) e está sendo usado contra o sandbox — os ambientes têm tokens separados e não intercambiáveis.
2. O token é da **API v3** (formato diferente, autenticação por header `Authorization`), incompatível com as chamadas v1 atuais.
3. O token foi revogado/regerado depois de salvo aqui.

## O que será feito

1. Teste isolado do token contra os dois ambientes (sandbox e produção) para identificar em qual ele é válido, sem alterar código ainda.
2. Conforme o resultado:
   - Token válido em produção → atualizar `CLICKSIGN_BASE_URL` para `https://app.clicksign.com` (e ajustar a URL do webhook no painel de produção).
   - Token inválido nos dois → abrir o formulário seguro para você colar um token novo, gerado em Configurações → API do ambiente escolhido.
   - Token identificado como v3 → adaptar o cliente `clicksign.server.ts` para o fluxo v3 (envelopes + header de autenticação), o que é uma mudança maior e será tratada como etapa separada.
3. Melhorar a mensagem de erro exibida no card: hoje aparece o JSON cru do Clicksign; passará a indicar em português qual é o problema (token inválido, sem crédito, documento recusado etc.).
4. Reteste ponta a ponta: arrastar um contrato para **Assinatura**, confirmar signatários, verificar disparo dos e-mails e o retorno do webhook.

## Detalhes técnicos

- `src/lib/juridico/clicksign.server.ts`: leitura dos segredos e montagem da URL já estão corretas; a mudança prevista é apenas o tratamento de erro (mapear 401/403/404/422 para mensagens claras).
- Nenhuma migração de banco necessária.
- `CLICKSIGN_BASE_URL` continua controlando sandbox vs produção — sem hardcode.

## Uma decisão sua

Precisa me dizer se o token `27e6…` foi criado no **sandbox** ou na conta de **produção** do Clicksign. Se foi em produção, a troca é imediata (base URL + webhook de produção). Se foi no sandbox, geramos um token novo.
