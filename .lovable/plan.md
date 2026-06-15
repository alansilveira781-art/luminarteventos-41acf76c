## Diagnóstico

Encontrei dois problemas distintos:

**1. Maicon recebe alertas de estoque**
O trigger `notify_stock_alert` no banco notifica TODOS os usuários que têm o módulo `estoque` no perfil. O Maicon tem acesso ao Estoque (para visualizar), então entra no broadcast.

**2. Maicon não recebe a notificação de "Pendente Aprovação"**
A função `notifyResponsiblesForStatus` em `src/lib/notify.ts` está com a regra antiga para o status `pendente_aprovacao`:
```
pendente_aprovacao: { modules: [], admin: true }
```
Ou seja, hoje só notifica usuários com role `admin` global. O Maicon não é admin global — ele é o **responsável da coluna** configurado em `compras_status_defaults` (status=`pendente_aprovacao` → Maicon Viana). A função simplesmente ignora essa tabela de responsáveis por coluna.

## Correções

### 1. Tabela de "silenciamento" de notificações por módulo
Nova tabela `notification_mutes (user_id, modulo_slug)`. Quando um par existir, esse usuário é excluído dos broadcasts daquele módulo.

- Migration cria a tabela com GRANTs + RLS (cada usuário vê/edita o próprio; admin gerencia todos).
- Inserir registro `(Maicon, 'estoque')` para silenciar imediatamente.

### 2. Trigger `notify_stock_alert` respeita os mutes
Atualizar a função para excluir usuários presentes em `notification_mutes` com `modulo_slug='estoque'`:
```sql
... FROM user_modulos um
WHERE um.modulo_id = v_modulo_id
  AND NOT EXISTS (
    SELECT 1 FROM notification_mutes nm
    WHERE nm.user_id = um.user_id AND nm.modulo_slug = 'estoque'
  );
```

### 3. `notifyResponsiblesForStatus` passa a considerar o responsável da coluna
Em `src/lib/notify.ts`:
- Para todo status, ler `compras_status_defaults` e incluir o `responsavel_id` configurado.
- Manter a lógica atual de notificar por módulo/admin como fallback.
- Resultado: ao mover um card para `pendente_aprovacao`, Maicon (responsável da coluna) é notificado, mesmo sem ser admin global.

Também aplicar o mute aqui: ao notificar por módulo, filtrar os user_ids que silenciaram aquele módulo (para o caso `a_receber`/`finalizado` que envolvem `estoque`).

### Detalhes técnicos
- Arquivos: nova migration; edição em `src/lib/notify.ts`.
- Sem mudanças de UI nesta etapa (silenciamento gerenciável por SQL/admin). Se quiser, depois adiciono uma tela em Admin → Usuários para alternar mutes por módulo.

## Fora do escopo (perguntar depois se necessário)
- Tela de gerenciamento dos mutes (por enquanto fica via banco/admin).
- Aplicar a mesma lógica de "responsável da coluna" para demandas/comercial (hoje a pergunta foi sobre compras).