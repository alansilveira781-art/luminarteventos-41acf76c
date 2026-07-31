## Objetivo

Expor o sistema Luminart como um **servidor MCP**, para que o Claude (Desktop, claude.ai ou Claude Code) se conecte ao app e consulte/atualize dados em nome do usuário logado.

## Segurança: login obrigatório (OAuth)

O sistema tem contas de usuário e dados sensíveis (financeiro, compras, RH, jurídico) protegidos por RLS. Portanto o servidor MCP **não** será público: cada pessoa que conectar o Claude fará login na conta dela e as ferramentas rodarão com exatamente as mesmas permissões que ela já tem no painel. Nada de acesso anônimo.

Fluxo: Claude → tela de consentimento do Luminart → login → Claude passa a operar como aquele usuário.

## Ferramentas propostas (primeira leva, foco em leitura)

| Ferramenta | O que faz |
| --- | --- |
| `listar_eventos` | Eventos por período/status, com locais adicionais |
| `listar_compras` | Compras por status/período/centro de custo |
| `listar_despesas` | Demandas/despesas por status e tipo |
| `consultar_estoque` | Busca de itens por nome/código/categoria e saldo |
| `listar_meus_pedidos` | Solicitações do próprio usuário e situação |
| `resumo_financeiro` | Totais consolidados por período (receitas/despesas) |

Todas somente leitura nesta primeira etapa. Ferramentas de escrita (criar solicitação, comentar em card) podem entrar depois, com confirmação — prefiro validar o acesso antes de liberar alteração de dados por chat.

## Implementação

1. Instalar `@lovable.dev/mcp-js` (com a exceção necessária no `bunfig.toml`).
2. Ativar o servidor OAuth do backend e criar a rota de consentimento `src/routes/[.]lovable.oauth.consent.tsx`, reaproveitando o `/auth` existente (inclusive preservando o retorno após login por senha e por Google).
3. Criar `src/lib/mcp/index.ts` (definição do servidor: nome `grupo-luminart`, auth OAuth) e `src/lib/mcp/supabase.ts` (client que repassa o token do usuário, RLS aplicada).
4. Um arquivo por ferramenta em `src/lib/mcp/tools/`, consultando as tabelas existentes.
5. Registrar o plugin MCP no `vite.config.ts` (endpoint em `/mcp`) e validar o manifesto.

Nenhuma alteração de schema, RLS ou telas atuais do sistema.

## Ao final

Você recebe a URL do servidor MCP para colar no Claude (Settings → Connectors), e cada usuário autoriza a própria conta.
