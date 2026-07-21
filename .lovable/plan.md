## Módulo Eventos

**1. Expectadores — link do calendário protegido por login**
- Nova coluna `is_expectador_eventos boolean` em `profiles` (default `false`).
- Em `/admin/usuarios`, adicionar checkbox "Pode ver calendário público de eventos" na edição de usuários.
- Mover a rota atual `/calendario-publico` para `/_authenticated/calendario-eventos` (com o mesmo componente). O `beforeLoad` verifica se o usuário é admin, tem módulo `eventos`, ou tem `is_expectador_eventos = true`; se não, redireciona para `/dashboard`.
- Adicionar item na sidebar "Calendário de Eventos" visível para usuários com esse acesso.
- Remover/redirecionar a rota pública antiga para o login.

**2. Cores no Gantt**
- Em `src/components/eventos/GanttEventos.tsx`: mudar `COR_MONTAGEM` de laranja (`#EF9F27`) para **verde** (ex.: `#16A34A`) e `COR_DESMONTAGEM` de cinza (`#888780`) para **laranja** (`#EF9F27`). Evento continua azul.
- Ajustar as legendas correspondentes na barra.

**3. Formato de datas no diálogo do calendário**
- Em `src/routes/calendario-publico.tsx` (que virá a ser a rota protegida), trocar o separador de `→` para `-`, resultando em `08/07/2026 - 09/07/2026`. Quando início e fim caem no mesmo dia, mantém uma única data (comportamento atual).

---

## Meus Pedidos — casar por e-mail OU nome do solicitante

Em `src/routes/meus-pedidos.tsx`, ampliar o `orFilter` para incluir também correspondência por `solicitante` (nome), casando com o `display_name` do perfil e com o e-mail (normalizado: `trim` + `lower`). Ordem final:

```
solicitante_id.eq.{uid},
created_by.eq.{uid},
solicitante_email.ilike.{email},        // usar coluna real se existir; hoje só temos 'observacoes' contendo o e-mail
observacoes.ilike.%{email}%,
solicitante.ilike.%{displayName}%,
solicitante.ilike.%{email antes do @}%
```

Buscar `display_name` via `useAuth().user` + `profiles`. Aplicar o mesmo filtro tanto para `compras` quanto `demandas`. Assumo tolerância de falsos positivos (homônimos), conforme escolhido.

---

## Formulário de Solicitação (`/solicitar`)

**1. Remover "Valor estimado total (R$)"** do passo 1 (`Field` em `src/routes/solicitar.tsx` linhas ~330–336) e retirar do `payload` enviado ao endpoint.

**2. Persistência local (rascunho no navegador)**
- Salvar `form` e `anexos` (apenas metadados; File não pode ir para localStorage) em `localStorage` sob chave `solicitar:draft:v1` a cada mudança, com debounce (~500 ms).
- Ao montar, restaurar o rascunho automaticamente (sem prejudicar backend — dados só saem quando o usuário clica "Enviar").
- Limpar o rascunho quando `done` é preenchido (envio bem-sucedido) ou quando o usuário clicar "Enviar outra solicitação".
- Anexos não são restaurados (limitação técnica) — exibir aviso discreto se havia anexos no rascunho.

**3. Preenchimento dos itens obrigatório (tipo Compra)**
- Já hoje `canAdvance()` exige ≥ 1 item com descrição e quantidade > 0; adicionar validação **por linha** ao clicar Avançar/Enviar: descrição obrigatória, quantidade > 0. Marcar campos em vermelho e mostrar toast se faltar dado. Não deixar itens em branco passarem.

**4. Campo "Data de Solicitação"**
- Adicionar no passo 1 um `Input type="date"` obrigatório com default = hoje, permitindo alterar (para pessoas que registram atrasado).
- Enviar no payload como `data_solicitacao`.
- Atualizar `src/routes/api/public/solicitar.ts`: aceitar `data_solicitacao` opcional no schema (com fallback para hoje) e gravar em `compras.data_solicitacao` / `demandas.data_solicitacao`.

---

## Módulo Estoque

**1. Recebimento de Despesa igual ao de Compra**
Em `src/routes/estoque.a-receber.tsx`, atualizar `ReceberDemandaDialog` para ter o mesmo comportamento de `ReceberDialog`:
- Buscar e exibir anexos da despesa (bucket `demanda-anexos`, tabela `demanda_anexos`) com preview via `AnexoViewer` e download.
- Para itens sem `item_id` associado, oferecer o mesmo bloco de "Associar a item existente / Cadastrar novo item / Desfazer associação" já usado nas compras (reutilizando `ItemSearchSelect` + `CadastrarItemInline`).
- Persistir a associação escolhida em `demanda_itens.item_id` no momento de finalizar.

**2. Padronizar exibição do ID no diálogo "Validar recebimento"**
- Investigar por que o `COMPRA-{numero}` do compra dialog às vezes não aparece (provavelmente `compra` ainda carregando ou `numero` nulo). Garantir que o cabeçalho do diálogo mostre sempre `COMPRA-{numero}` / `DESPESA-{numero}` no mesmo lugar, com o mesmo estilo (`text-xs font-mono px-2 py-0.5 rounded bg-muted`). Se `numero` for `null`, mostrar fallback `COMPRA-—` para não sumir.
- Remover a duplicação da linha `COMPRA-{numero}` no bloco de resumo logo abaixo (linhas 483–488) para deixar visualmente igual ao layout da despesa.

---

## Detalhes técnicos

- Migração: adicionar coluna `is_expectador_eventos` em `profiles` + política de leitura já cobre.
- Nenhum novo bucket ou tabela necessária.
- Sidebar (`AppSidebar.tsx`): novo item condicional.
- Sem mudança em RLS de `demandas` / `demanda_anexos` — leitura por módulo `estoque` já existe.
- `data_solicitacao` já é coluna existente em `compras` e `demandas` (mudança só no endpoint público).
