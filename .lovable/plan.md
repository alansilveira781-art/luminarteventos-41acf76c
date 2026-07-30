## Diagnóstico (verificado)

Consultei o banco e a página. Duas causas, ambas confirmadas:

1. **As solicitações não ficam vinculadas ao usuário.** Nas 161 compras existentes, 30 vieram do formulário público `/solicitar`. Nelas, o endpoint público grava apenas `solicitante` com o **nome** digitado (ex.: "Luciene Albuquerque") e joga o e-mail dentro do texto de `observacoes`. Os campos de vínculo (`created_by`, `solicitante_id`) ficam vazios, porque o formulário é anônimo.

2. **A regra de leitura do banco (RLS) não enxerga essas linhas.** A política de leitura para quem não tem o módulo Compras/Financeiro só libera a linha quando `created_by = usuário`, `solicitante_id = usuário` ou `solicitante` é **exatamente igual** ao e-mail do usuário. Como `solicitante` guarda o nome, nenhuma dessas condições bate — o banco simplesmente não devolve o pedido, por mais que a tela filtre por nome/e-mail. O mesmo vale para `demandas`.

Ou seja: o filtro da tela até tenta casar por nome e e-mail, mas o banco já removeu as linhas antes.

## O que fazer

### 1. Guardar o e-mail do solicitante em coluna própria
- Migração: adicionar `solicitante_email text` em `compras` e `demandas` (com índice em `lower(solicitante_email)`).
- Endpoint público `/api/public/solicitar`: gravar `solicitante_email` com o e-mail informado no formulário e, quando esse e-mail existir em `profiles`, preencher também `solicitante_id` — assim o pedido já nasce vinculado ao usuário.
- Fazer o mesmo no formulário público de contrato somente se o usuário quiser (fora do escopo aqui).

### 2. Backfill dos pedidos antigos
- Migração de dados: extrair o e-mail que está escrito em `observacoes` (padrão `email: xxx@yyy`) e preencher `solicitante_email`; onde o e-mail existir em `profiles`, preencher `solicitante_id`.
- Para pedidos criados internamente sem e-mail, preencher `solicitante_email` a partir do `profiles` do `created_by`/`solicitante_id` quando existir.

### 3. Ajustar as políticas de leitura
- Recriar `compras_select_owner` e `demandas_select_owner` para também liberar quando `lower(solicitante_email) = lower(e-mail do usuário logado)`, mantendo as condições atuais.
- Nenhuma ampliação além disso: continua sendo "o próprio solicitante vê o próprio pedido".

### 4. Simplificar a tela `src/routes/meus-pedidos.tsx`
- Trocar o filtro atual (vários `ilike` em `solicitante`/`observacoes`, que pode gerar falsos positivos e quebra com nomes contendo vírgula) por: `solicitante_id`, `created_by`, `solicitante_email` (igualdade por e-mail) e, como rede de segurança, `solicitante` igual ao nome de exibição.
- Exibir o e-mail do solicitante no detalhe do pedido.

## Detalhes técnicos

- Tabelas afetadas: `compras`, `demandas` (nova coluna + índice + políticas SELECT recriadas).
- Arquivos: `src/routes/api/public/solicitar.ts`, `src/routes/meus-pedidos.tsx`.
- O `GRANT` das tabelas já existe; a migração só recria políticas.
- Sem mudança nos Kanbans de Compras/Despesas — quem tem o módulo continua vendo tudo como hoje.

## Verificação

Depois de aplicar, conferir por consulta que os 30 pedidos públicos passam a ter `solicitante_email` preenchido e que um usuário comum (sem módulo Compras) consegue listar os próprios pedidos em Meus Pedidos.
