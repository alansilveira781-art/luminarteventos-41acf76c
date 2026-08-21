# Ativar a integração com o Dropbox

Recebi a chave e o segredo do app. O terceiro valor enviado tem o formato de um
**código de autorização** (o código que o Dropbox mostra na tela), e não de um
refresh token — refresh tokens começam com `sl.u.`. Códigos de autorização são de
uso único e expiram em poucos minutos, então preciso trocá-lo pelo token
definitivo antes de guardar.

## O que farei ao aprovar

1. Trocar o código pelo refresh token chamando o endpoint de token do Dropbox
   (`grant_type=authorization_code`) com a chave e o segredo do app.
2. Salvar nos segredos do projeto: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` e
   `DROPBOX_REFRESH_TOKEN` (o valor obtido no passo 1).
3. Testar a conexão criando/validando o caminho raiz `/EVENTOS DA SEMANA` e
   confirmando que o token renova sozinho.
4. Trocar os valores enviados no chat por armazenamento seguro — depois disso,
   recomendo apagar a mensagem com o segredo.

## Se o código já tiver expirado

Faço uma nova tentativa e, se o Dropbox recusar, peço que você reabra a URL de
autorização abaixo e me envie o novo código (válido por poucos minutos):

```text
https://www.dropbox.com/oauth2/authorize?client_id=wwzwqv615qdm0m2&response_type=code&token_access_type=offline
```

Antes disso, confirme na aba **Permissions** do app que estão marcadas:
`files.content.write`, `files.content.read` e `sharing.write` (e clique em Submit).

## Depois de conectado

O passo 3 do assistente "Concluir contrato" (Jurídico) passa a criar de verdade a
estrutura de pastas do evento no Dropbox e a enviar o contrato assinado e a
proposta para `04 - DOC`.
