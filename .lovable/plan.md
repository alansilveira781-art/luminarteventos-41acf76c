## Diagnóstico

A URL no print mostra `state=ESTADO` — esse é o **placeholder literal** da documentação do Conta Azul. Isso significa que essa chamada **não veio do botão "Conectar" do app** — veio de uma URL de teste/exemplo (provavelmente colada manualmente ou de um link de teste do painel do Conta Azul).

O cookie `ca_oauth_state` só é criado quando você clica em "Conectar" dentro de `/financeiro/conta-azul`. Como não havia cookie, o handler tenta redirecionar com erro "State inválido (sessão expirada)" — mas o `Response.redirect()` está sendo capturado pelo h3 como erro não tratado e retorna `{"status":500,"unhandled":true,"message":"HTTPError"}` em vez do redirect amigável.

Secrets `CONTA_AZUL_CLIENT_ID` / `CONTA_AZUL_CLIENT_SECRET` estão configurados — não é problema de credenciais.

## Correções

**1. `src/routes/api/contaazul/oauth.callback.ts`** — tornar o handler à prova de falhas:
- Trocar `Response.redirect(url, 302)` por `new Response(null, { status: 302, headers: { Location: url } })` (mais confiável no workerd e não é interpretado como erro pelo h3).
- Envolver o handler inteiro em um `try/catch` externo que sempre retorna um redirect 302 para `/financeiro/conta-azul?error=...` mesmo se algo inesperado lançar.
- Logar o erro real no `console.error` antes de redirecionar (para aparecer nos logs).

**2. Mensagem ao usuário sobre o `state=ESTADO`:**
Após o fix, se você acessar essa URL de novo, verá a tela do Conta Azul com a mensagem "State inválido (sessão expirada)" em vez do JSON cru. Para conectar de verdade:
- Acesse `/financeiro/conta-azul` no app
- Clique no botão **"Conectar"**
- Será redirecionado para o Conta Azul, autorize, e voltará automaticamente com `?connected=1`

Não cole/abra manualmente a URL `/api/contaazul/oauth/callback` — ela só funciona dentro do fluxo iniciado pelo botão.

## Verificação

- Abrir a URL antiga manualmente → deve redirecionar para `/financeiro/conta-azul` com toast de erro (não mais JSON 500).
- Clicar em "Conectar" no app → fluxo completo deve funcionar e mostrar "Conta Azul conectado com sucesso!".

Arquivos alterados: 1 (`src/routes/api/contaazul/oauth.callback.ts`).