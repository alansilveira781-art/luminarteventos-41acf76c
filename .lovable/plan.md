## Diagnóstico

Hoje o sync captura apenas o **primeiro** item dos arrays `categorias` e `centros_de_custo` do payload do Conta Azul:

```text
categoria_external_id      = it.categorias?.[0]?.id
centro_custo_external_id   = it.centros_de_custo?.[0]?.id
```

Quando um lançamento é **rateado** (vários centros e/ou várias categorias com valores/percentuais distintos), só o primeiro entra no banco e todo o `valor` do lançamento é atribuído a ele. Resultado: o evento que aparece em segundo/terceiro no rateio fica invisível, e o evento principal recebe o total cheio em vez da sua fração.

Também ainda está ativo o filtro por **nome normalizado** na Análise Detalhada (`normTxt(nome) === nomeCentroSel` → `.in(centro_custo_external_id, centroIds)`), o que mistura centros de nomes parecidos.

## Plano

### 1. Nova tabela `ca_lancamento_rateios` (migration)

Uma linha por **alocação** (cc × categoria × parcela) de um lançamento.

```text
ca_lancamento_rateios
  id                      uuid pk
  lancamento_external_id  text   -- FK lógica para ca_contas_pagar.external_id OU ca_contas_receber.external_id
  tipo                    text   -- 'pagar' | 'receber'
  centro_custo_external_id text   nullable
  categoria_external_id    text   nullable
  valor                    numeric not null  -- valor absoluto da fatia
  percentual               numeric nullable
  ordem                    int     -- posição no array original
  synced_at                timestamptz
  unique (lancamento_external_id, tipo, ordem)
```

- RLS + GRANT idênticos às tabelas `ca_contas_*` (leitura `authenticated` com `has_module_access('financeiro')`).
- Índices em `(centro_custo_external_id)`, `(categoria_external_id)`, `(lancamento_external_id, tipo)`.

> Mantém os campos `categoria_external_id` e `centro_custo_external_id` em `ca_contas_pagar/receber` (compatibilidade), mas eles passam a ser apenas "primeiro rateio" — a verdade absoluta passa a ser a tabela de rateios.

### 2. Sync (`src/lib/conta-azul/sync.server.ts`)

- Para cada item de `contas_pagar` / `contas_receber`, montar `rateios[]` a partir de `it.centros_de_custo` × `it.categorias`:
  - Caso normal (1 cc + 1 categoria): 1 linha com `valor = it.total`.
  - Vários CCs: usar `valor`/`percentual` do próprio item do array; se a API não devolver, distribuir o total proporcionalmente pelos `percentual`; se nem isso vier, dividir igualmente.
  - Cruzamento cc×categoria: se a API devolver pares (estrutura `rateios`/`alocacoes`) usar tal qual; caso devolva listas separadas, gerar combinações 1:1 por índice (i.e., `cc[i]` ↔ `categoria[i]`), e se tamanhos diferem usar o último de cada lado para preencher.
- Upsert em batches por `(lancamento_external_id, tipo, ordem)`. Antes do upsert, `delete` das linhas órfãs do mesmo lançamento que não estão no novo conjunto (rateios podem ter sido reduzidos no Conta Azul).
- Bootstrap: a primeira execução faz um `truncate` da tabela de rateios apenas para o intervalo do job, evitando duplicidade legada.

> Para confirmar a estrutura exata dos campos `valor`/`percentual` dentro de `centros_de_custo`/`categorias`, adicionar **um único log temporário** no primeiro item com `centros_de_custo.length >= 2`, rodar 1 mês, ler o JSON e ajustar a função de geração de rateios. Remover o log no mesmo PR após o ajuste.

### 3. Análise Detalhada (`src/components/financeiro/ContaAzulDashboard.tsx`)

- **Filtro exato por ID**: trocar o agrupamento por nome (`centroIds = ccs.filter(normTxt === nomeSel)`) por `centroId` direto. `enabled = !!centroId`.
- **Fonte de dados muda**: em vez de buscar `ca_contas_pagar`/`receber` filtrando por `centro_custo_external_id`, buscar **primeiro** `ca_lancamento_rateios` `.eq('centro_custo_external_id', centroId)` para listar os `lancamento_external_id` + `valor` da fatia + `categoria_external_id` daquele evento. Depois enriquecer com os campos descritivos (`descricao`, `data_pagamento`, `status`, `fornecedor_nome`/`cliente_nome`) via `in('external_id', lancamentos)` em `ca_contas_pagar`/`receber`.
- **Lista de lançamentos**: cada linha usa o `valor` do rateio (fatia), não o `valor` total da conta. Quando o lançamento original tem outros rateios, mostrar tag "Rateado" ao lado do valor.
- **DRE da Análise**: `calcularDRECaixa` recebe pares `{categoria_external_id, valor, status, data_pagamento, descricao}` já fatiados (vindos da query de rateios + enriquecimento), portanto `RB/CV/DS/...` somam só a fatia que pertence ao centro selecionado. Sinais, transferências e cascata permanecem inalterados.
- Helpers mortos (`centroNeedle`, `needleTokens`, `rowMatchesText`, `normTxt` se sobrar sem uso) podem sair.

### 4. Painel Financeiro / Fluxo de Caixa

- Sem mudança de comportamento por padrão: continuam somando `ca_contas_*` direto (a fatia "primeiro rateio" já estava lá).
- Após validar a tabela de rateios, em iteração seguinte podemos migrá-los para consumir rateios também — fora do escopo deste passo.

### 5. Backfill

- Migration cria a tabela vazia.
- Enfileirar 1 job histórico `2023-01-01 → hoje` (mesmo padrão já usado). O processador mês a mês agora popula rateios além das colunas existentes.
- Disparar `/api/public/contaazul/cron` em loop até `status = 'ok'`, igual ao último backfill (~6 min).

## Validação

1. `select count(*) from ca_lancamento_rateios` > 0.
2. `select count(distinct lancamento_external_id) from ca_lancamento_rateios where centro_custo_external_id = '754b118a-...-MANDARA'` ≥ 43.
3. Existe pelo menos um `lancamento_external_id` com `count(*) > 1` na tabela de rateios (caso real de rateio detectado).
4. Na UI, selecionar "MANDARA": Total dos lançamentos = soma das fatias daquele CC (não mais o total cheio). Selecionar um centro de nome parecido não traz lançamentos do MANDARA, e vice-versa.

## Itens fora do escopo

- Sem mudança em sync de plano de contas, extrato, centros de custo cadastrais ou autenticação Conta Azul.
- Sem mudança em Painel/Fluxo (próximo passo opcional).
- Sem alteração no broker de auth, RLS de outros módulos ou outros dashboards.
