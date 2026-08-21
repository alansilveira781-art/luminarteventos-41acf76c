# Dropbox: como gerar o refresh token

Você não precisa cadastrar nenhuma URL de redirecionamento. O Dropbox tem um modo
"sem redirect" em que o próprio site mostra o código na tela.

## Passo a passo (5 minutos)

1. No App Console do seu app, aba **Permissions**, marque:
   - `files.content.write`
   - `files.content.read`
   - `sharing.write`
   - Clique em **Submit**.

2. Abra esta URL no navegador (a chave do app já é a sua, da imagem):

```text
https://www.dropbox.com/oauth2/authorize?client_id=wwzwqv615qdm0m2&response_type=code&token_access_type=offline
```

3. Autorize. O Dropbox mostra um **código de acesso** na tela. Copie.

4. Troque o código pelo refresh token. Cole no terminal (Prompt de Comando /
   PowerShell), substituindo `SEU_CODIGO` e `SEU_APP_SECRET`:

```text
curl https://api.dropboxapi.com/oauth2/token -d code=SEU_CODIGO -d grant_type=authorization_code -u wwzwqv615qdm0m2:SEU_APP_SECRET
```

5. A resposta traz `"refresh_token": "sl.u...."`. É esse valor que preciso.

## O que me enviar depois

Vou abrir o formulário seguro pedindo:

- `DROPBOX_APP_KEY` = `wwzwqv615qdm0m2`
- `DROPBOX_APP_SECRET` = o "Segredo do app" (botão **Show/Programa** na tela)
- `DROPBOX_REFRESH_TOKEN` = o valor do passo 5

## Observações

- O botão **Gerar** ("Token de acesso gerado") da tela cria um token que expira em
  4 horas — não serve para a integração automática. Por isso o fluxo acima.
- O campo **Webhook URIs** não é necessário para criar pastas; deixe vazio.
- Se preferir não usar o terminal, eu crio no app uma página interna de conexão
  (`/api/dropbox/oauth/callback`) e você autoriza clicando num botão — nesse caso
  a URL a cadastrar em "URIs de redirecionamento" seria:
  `https://grupoluminart.lovable.app/api/dropbox/oauth/callback`
  e também `https://id-preview--6426c238-9a04-43ca-bcba-50cca625fad7.lovable.app/api/dropbox/oauth/callback`.
  Me diga se quer esse caminho e eu implemento.
