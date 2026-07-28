## Problema

Quem recebe o link `/juridico/solicitar` sem estar logado é redirecionado para o login, mas o endereço original é perdido: em `src/routes/__root.tsx` o app faz `<Navigate to="/auth" />` sem guardar o destino, e em `src/routes/auth.tsx` o login sempre navega para `/` (a tela inicial "Bem-vindo / selecione um módulo"). Por isso a pessoa cai na tela inicial em vez do formulário.

## O que será feito

1. **Guardar o destino ao mandar para o login** (`src/routes/__root.tsx`)
   - Ao detectar que não há sessão, redirecionar para `/auth` levando o caminho atual (rota + query) em um parâmetro `redirect`.

2. **Voltar ao destino depois do login** (`src/routes/auth.tsx`)
   - Ler o parâmetro `redirect` (validado como caminho interno, começando com `/`, para evitar redirecionamento para sites externos).
   - Após login por e-mail/senha, ir para esse caminho; sem parâmetro, continua indo para `/`.
   - Se o usuário já estiver logado ao abrir `/auth`, também respeitar o `redirect`.
   - No login com Google, usar `redirectTo` na mesma origem preservando o `redirect`, para que a volta do provedor caia no formulário.

3. **Mensagem de contexto na tela de login**
   - Quando houver `redirect` apontando para `/juridico/solicitar`, exibir uma linha discreta do tipo "Entre para acessar o formulário de solicitação de contrato", para a pessoa entender por que o login apareceu.

4. **Sem acesso liberado**
   - Se a pessoa logar mas não estiver na lista de liberados (Jurídico › Configurações), continuará sendo mandada para a tela inicial. Posso, se quiser, trocar isso por uma mensagem clara "Você não tem permissão para preencher este formulário — peça liberação ao administrador" (digo já na implementação se preferir incluir).

## Detalhes técnicos

- `/auth` passa a declarar `validateSearch` com `redirect?: string`.
- Sanitização: aceitar apenas valores que começam com `/` e não com `//`.
- Nenhuma mudança de banco ou RLS.
