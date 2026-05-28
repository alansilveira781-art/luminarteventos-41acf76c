## Objetivo

1. Ajustar o cabeçalho no celular para não ficar "colado" no topo (atrás da barra de status/notch), prejudicando leitura e cliques.
2. Habilitar **notificações push reais no celular** (chegam mesmo com o app fechado), disparadas quando:
   - um card/tarefa é **atribuído** a um usuário;
   - há **alerta de estoque baixo/sem estoque** para quem tem acesso ao módulo Estoque.

---

## Parte 1 — Cabeçalho no mobile (safe area)

O app usa `apple-mobile-web-app-status-bar-style: black-translucent`, então em celular instalado o conteúdo sobe para trás da barra de status. Hoje o `AppTopBar` (`src/components/AppSidebar.tsx`) e o `<main>` (`src/routes/__root.tsx`) não reservam essa área.

Mudanças:
- **`src/components/AppSidebar.tsx`** (componente `AppTopBar`): adicionar respeito à área segura no topo do header `sticky`, aumentando a altura efetiva com `env(safe-area-inset-top)` (padding-top no header), para o conteúdo do cabeçalho descer abaixo da barra de status.
- **`src/routes/__root.tsx`**: garantir que o `<main>` e o sidebar considerem as áreas seguras laterais/inferior (`safe-area-inset-left/right/bottom`) no mobile.
- **`src/styles.css`**: adicionar utilitários/variáveis para as áreas seguras (`--safe-top`, etc.) usados acima, mantendo o padrão de tokens.

Resultado: o cabeçalho fica logo abaixo da barra de status, com cliques e leitura corretos no iOS e Android.

---

## Parte 2 — Push notifications no celular (Web Push)

Como o app é instalável (PWA), notificações com app fechado exigem **Web Push** (Service Worker + chaves VAPID + assinatura por dispositivo). Isso funciona **apenas no app instalado/publicado**, não no preview do editor.

### 2.1 Banco de dados (migração)
- Nova tabela `push_subscriptions` (`user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`), com RLS: cada usuário gerencia apenas as próprias assinaturas; `service_role` com acesso total.
- **Alerta de estoque**: adicionar trigger na tabela `itens` que, ao mudar para `baixo_estoque`/`sem_estoque`, insere notificações em `notificacoes` para os usuários do módulo Estoque (reaproveitando o fluxo existente).
- **Disparo do push**: trigger `AFTER INSERT` em `notificacoes` que chama (via `pg_net`) um endpoint público para enviar o push ao(s) dispositivo(s) do usuário. Assim, todas as notificações já existentes (atribuição de card via `notify.ts`, menções, status, estoque) passam a gerar push automaticamente.

### 2.2 Service Worker
- Criar `public/sw.js` (Service Worker dedicado a push), tratando os eventos `push` (exibir notificação) e `notificationclick` (abrir o `link` da notificação).
- Registro do SW **com proteção**: nunca registrar em iframe nem em domínio de preview (`id-preview--` / `lovableproject.com`), conforme as regras de PWA do Lovable. Ativo só no app publicado.

### 2.3 Front-end
- Botão/itens em "Notificações" (ou no sino) para **"Ativar notificações neste dispositivo"**: pede permissão, cria a `PushSubscription` com a chave pública VAPID e salva em `push_subscriptions`.
- Tratar estado de permissão negada com mensagem clara.

### 2.4 Backend (envio do push)
- Server route público `src/routes/api/public/send-push.ts` que recebe o `notificacao` (id/usuário), busca as assinaturas do usuário e envia o Web Push assinado com VAPID. Validação de entrada com Zod e autenticação via `apikey` (anon key), padrão de endpoints públicos.
- Remover automaticamente assinaturas inválidas (410/404).

### 2.5 Chaves VAPID (necessário)
Para assinar os pushes preciso de um par de chaves VAPID:
- Chave **pública** (vai no código/cliente) e chave **privada** (segredo no backend).
- Vou **gerar** o par e solicitar o armazenamento da chave privada como segredo (`VAPID_PRIVATE_KEY`) e o e-mail de contato (`VAPID_SUBJECT`).

---

## Detalhes técnicos
- Lib de envio: `web-push` (compatível com o runtime). Se houver incompatibilidade no Worker, uso assinatura VAPID/JWT via Web Crypto nativo.
- `notificacoes` já tem realtime para o sino in-app; o push é complementar para quando o app está fechado.
- Nada de cache-first no Service Worker (somente push), evitando os problemas conhecidos de PWA no preview.

## Observação importante
As notificações push **só funcionarão no app publicado/instalado** (https://luminarteventos.lovable.app), não dentro do preview do editor. No iPhone, é necessário **instalar o app na tela inicial** (Web Push no iOS exige o app instalado).
