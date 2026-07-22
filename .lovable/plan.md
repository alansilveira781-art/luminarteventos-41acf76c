# Vincular Vendedor ao Usuário pelo cadastro

Hoje a aba **Vendedores** do Dashboard tenta descobrir "qual consultor é o usuário logado" comparando o nome do perfil com o nome do vendedor por normalização de texto. Isso é frágil (basta diferença de acento, apelido ou sobrenome para quebrar) e não usa o cadastro real.

Vamos amarrar tudo ao cadastro em **Configurações → Vendedores (Consultor(a))**: cada vendedor passa a ter um usuário responsável, e todo o restante lê essa amarração.

## Mudanças

### 1. Banco
- Adicionar coluna `user_id uuid` em `comercial_vendedores`, referenciando `auth.users(id)`, `UNIQUE` (um usuário só pode ser um vendedor) e `ON DELETE SET NULL`.
- Sem migração automática de dados: como o vínculo é sensível, o administrador escolhe manualmente na tela quem é quem.

### 2. Configurações → Vendedores (Consultor(a))
- Novo campo no formulário de cadastro/edição: **"Usuário vinculado"** — combobox listando os usuários que têm acesso ao módulo Comercial (mesma consulta já usada no card "Acesso ao Dashboard").
- Nova coluna **"Usuário"** na tabela, mostrando o nome/e-mail do usuário vinculado (ou "—").
- Validação: bloqueia salvar quando o usuário escolhido já estiver vinculado a outro vendedor.

### 3. Dashboard Comercial → aba Vendedores
- Substituir o casamento por nome pelo vínculo salvo: buscar em `comercial_vendedores` o registro `user_id = auth.uid()` e usar o `nome` desse vendedor para travar o filtro.
- Mensagem de aviso quando o usuário não tiver vendedor vinculado passa a orientar: "Peça ao administrador para vincular seu usuário em Configurações → Vendedores".
- Administradores do módulo continuam vendo o seletor completo de "Consultores".

### 4. Card "Acesso ao Dashboard Comercial"
- Adicionar uma coluna curta indicando o **vendedor vinculado** (ou "—") ao lado do nome de cada usuário, para o administrador entender rapidamente quem já está amarrado.

## Fora do escopo
- Não vamos usar esse vínculo em outros lugares (propostas, cards, comissões) neste passo — apenas no filtro do Dashboard. Se quiser estender depois (ex.: filtrar propostas/cards pelo `user_id` do vendedor), fazemos em um segundo passo.
- O helper `normalizarNome` fica no código por enquanto (não é mais usado no filtro), pode ser removido em uma limpeza posterior.

## Detalhes técnicos

- Migração:
  ```sql
  ALTER TABLE public.comercial_vendedores
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  CREATE UNIQUE INDEX comercial_vendedores_user_id_key
    ON public.comercial_vendedores(user_id) WHERE user_id IS NOT NULL;
  ```
- `src/lib/comercial/cadastros.ts`: incluir `user_id` no tipo e no upsert.
- `src/routes/comercial.configuracoes.tsx` (`VendedoresCard`): novo `Select` de usuário no diálogo; nova coluna na tabela.
- `src/routes/comercial.dashboard.index.tsx`: nova query `comercial_vendedores.select("nome, user_id").eq("user_id", user.id).maybeSingle()` substitui `meuNomeNorm` / `normalizarNome` no cálculo de `meuConsultor`.
- `AcessoDashboardCard` em Configurações: juntar `comercial_vendedores` no lookup existente por `user_id`.
