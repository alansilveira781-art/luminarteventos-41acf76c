# Lembretes — Prompts 3 e 4: notificações de desktop e Web Push

## Estado atual

O que já existe:

- Tabelas `lembretes_projetos` e `lembretes_tarefas` com RLS por usuário.
- Tabela `push_subscriptions` com RLS por usuário.
- `public/manifest.json` configurado para PWA.
- `public/sw.js` tratando eventos `push` e `notificationclick`.
- `src/lib/push.ts` com funções de assinatura/desassinatura push.
- Componente `PushNotificationsToggle` pronto.

O que ainda falta:

- Registro do service worker no aplicativo.
- Polling interno de 60 s que dispara notificações do navegador para tarefas cujo lembrete já chegou.
- Botão de som curto ligar/desligar no cabeçalho dos Lembretes.
- Endpoint servidor que busca tarefas pendentes com lembrete vencido e envia push.
- Job `pg_cron` a cada 5 minutos chamando esse endpoint.
- Chaves VAPID geradas e armazenadas como segredo do backend.

## O que será implementado

### 1. Notificações do navegador enquanto o app está aberto (Prompt 3)

- Na tela `/lembretes`, ao carregar, verificar a permissão de notificação.
- Se for a primeira visita, solicitar permissão automaticamente.
- Se o usuário negar, mostrar aviso discreto no topo oferecendo um botão para pedir permissão de novo.
- Verificador a cada 60 segundos busca tarefas pendentes onde `data_hora - lembrete_min` já passou e `notificada_em` é nulo.
- Para cada tarefa encontrada, dispara notificação do sistema com título, horário e nome do projeto; em seguida grava `notificada_em`.
- Clicar na notificação foca a janela e abre o modal da tarefa.
- Botão no cabeçalho para ativar/desativar toque sonoro curto opcional.

### 2. Web Push para lembretes com app fechado (Prompt 4)

- Criar rota servidor pública `src/routes/api/public/hooks/enviar-lembretes.ts`.
- A rota recebe chamadas do `pg_cron`, busca tarefas pendentes com lembrete vencido e `notificada_em` nulo, envia push para as inscrições do usuário dono e grava `notificada_em`.
- Usar a biblioteca `web-push` no servidor com chaves VAPID.
- Gerar novo par de chaves VAPID e armazenar a chave privada como segredo do backend; a chave pública fica no front (`src/lib/push.ts`).
- Criar job `pg_cron` para chamar a rota a cada 5 minutos usando `net.http_post` com header `apikey`.
- Registrar o service worker apenas em ambiente publicado/instalado, nunca no preview do Lovable nem em iframe.

## Detalhes técnicos

- `src/routes/lembretes.tsx`: adicionar `useEffect` de polling, banner de permissão e botão de som.
- `src/lib/lembretes.ts`: adicionar função `calcularHorarioLembrete(data_hora, lembrete_min)`.
- `src/routes/__root.tsx` ou componente cliente: registrar `/sw.js` apenas quando não estiver em preview/iframe.
- `src/routes/api/public/hooks/enviar-lembretes.ts`: endpoint POST com validação do header `apikey`, usando `web-push` e `supabaseAdmin` para atualizar `notificada_em`.
- Migração SQL: criar extensão `pg_net` (se não existir) e agendar o job `enviar-lembretes`.
- Segredo: `VAPID_PRIVATE_KEY` adicionada via ferramenta de secrets.
