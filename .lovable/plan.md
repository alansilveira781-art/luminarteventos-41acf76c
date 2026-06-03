
## Diagnóstico

O erro "Illegal character in query at index 240" vem do servidor do Conta Azul tentando parsear a URL e quebrando no espaço dentro do parâmetro `scope=sales finance accounts cost-centers bank-statements`. Dois problemas combinados:

1. **Endpoint errado.** Estamos chamando `http://api.contaazul.com/auth/authorize` (API v1, legado). A nova autenticação do Conta Azul usa **AWS Cognito** em `https://auth.contaazul.com` — como mostra a URL que você pegou no painel do desenvolvedor.
2. **Scopes errados.** O Cognito espera escopos OpenID: `openid profile aws.cognito.signin.user.admin`. Os scopes antigos (`sales finance accounts cost-centers bank-statements`) não existem mais nesse fluxo e provavelmente são o que está causando o servidor a rejeitar o request.

(O `URLSearchParams` codifica espaço como `+`, que é válido em query string — então o problema não é encoding, é endpoint + scopes inválidos para esse host.)

## Correções em `src/lib/conta-azul/client.server.ts`

- Trocar bases:
  - `AUTHORIZE_URL` → `https://auth.contaazul.com/oauth2/authorize`
  - `TOKEN_URL` → `https://auth.contaazul.com/oauth2/token`
  - Manter `API_BASE` em `https://api.contaazul.com/v1` para chamadas de dados (Plano de Contas, etc.).
- Trocar `DEFAULT_SCOPES` para `"openid profile aws.cognito.signin.user.admin"`.
- Manter Basic Auth no token endpoint (Cognito aceita), `grant_type=authorization_code` e `refresh_token` iguais.

## Verificação

1. Clicar em **Conectar** em `/financeiro/conta-azul` → deve redirecionar para `auth.contaazul.com` (tela de login do Conta Azul, não mais erro Java).
2. Autorizar → volta no callback com `?connected=1` e toast de sucesso.
3. Rodar "Sincronizar agora" → as chamadas a `/v1/...` devem funcionar com o token do Cognito.

Se as chamadas `/v1/...` retornarem 401/403 depois da conexão, será porque a sua aplicação no Conta Azul não tem permissão para os recursos antigos via Cognito — nesse caso você precisa habilitar os escopos/permissões no painel do desenvolvedor do Conta Azul para o `client_id` `74c1v0ns1cs0e9fsmqdq22a78f`. Eu te aviso na hora se isso acontecer.

## Arquivos alterados

- `src/lib/conta-azul/client.server.ts` (1 arquivo)

