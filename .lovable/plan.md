### Objetivo

Evitar reprocessamentos históricos gigantescos (que estouram o token do Conta Azul) permitindo reprocessar rateios categoria por categoria, direto do dashboard, apenas dos lançamentos já carregados na tela.

### Como vai funcionar

Em `src/components/financeiro/ContaAzulDashboard.tsx`, cada linha de categoria do Demonstrativo (nos dois dashboards — Painel Financeiro em regime de caixa e Análise Detalhada em competência) ganha um botão discreto (ícone `RefreshCw`, `variant="ghost"`, `size="icon"`, aparecendo em hover) ao lado do nome da categoria.

Ao clicar:

1. O front coleta os `external_id` dos lançamentos daquela categoria já filtrados pelo período visível na tela (usa o `lancamentos`/`lancFiltrados` que a própria linha já agrega — nada de novo query).
2. Divide em lotes de 20 ids e chama `POST /api/contaazul/reprocessar-rateios` com `{ ids: [...], tipo, limite: chunk.length }` em sequência até acabar. O endpoint e o `reprocessarRateios` do servidor já aceitam a lista explícita de ids — nenhuma mudança de backend necessária.
3. Mostra progresso no próprio botão (spinner + contador `n/total`) e um `toast` final com `X corrigidos · Y falhas`.
4. Só admins do módulo financeiro veem o botão (mesma checagem que hoje libera "Reprocessar tudo" na página `/financeiro-op/conta-azul`).

### Por que isso resolve o problema do token

- A janela de trabalho é sempre pequena (uma categoria dentro do período do dashboard, tipicamente dezenas de lançamentos), então cabe em uma ou duas chamadas curtas — bem abaixo do tempo em que o access_token expira.
- Se algo falhar, dá para reclicar só naquela categoria sem refazer o histórico inteiro.
- O botão "Sincronizar histórico" em `/financeiro-op/conta-azul` continua existindo para quem preferir o lote grande.

### Detalhes técnicos

Arquivo alterado: `src/components/financeiro/ContaAzulDashboard.tsx` apenas.

- Adicionar `external_id: string` ao tipo `LancRow` e ao `push()` que monta `lancamentos`. As queries `pagarCols`/`receberCols` já trazem o campo — é só passá-lo adiante, sem query nova.
- Novo helper local `reprocessarCategoria(catId, tipo)` que:
  - Deriva `ids = [...new Set(lancamentos.filter(l => l.categoria_external_id === catId).map(l => l.external_id))]`.
  - Loop em chunks de 20 chamando `fetch("/api/contaazul/reprocessar-rateios", { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ ids: chunk, tipo, limite: chunk.length }) })`.
  - Reenvia o mesmo chunk enquanto a resposta trouxer `restantes > 0`, com teto de 3 tentativas por chunk — o servidor corta o lote ao atingir `BUDGET_MS`, e somar apenas `corrigidos` esconderia os itens não processados.
  - Acumula `corrigidos`/`falhas` do retorno e atualiza estado local `reprocByCat: Record<catId, { running, done, total, corrigidos, falhas }>`.
  - Ao final: `qc.invalidateQueries` das queries do dashboard (`ca-*`) e `toast.success/error`.
- `tipo` (`"pagar"` | `"receber"`) é derivado do grupo do DRE a que a linha pertence e enviado no payload. Sem ele o servidor consulta as duas tabelas por chunk e pode truncar o lote.
- `authHeaders()` copiado do mesmo padrão já usado em `src/routes/financeiro-op.conta-azul.tsx` (`supabase.auth.getSession()` → `Authorization: Bearer`).
- Botão renderizado dentro do `<tr>` de cada categoria (`kind === "detail"`, nunca em header/calc), com `onClick` que faz `stopPropagation` para não disparar o `onClickCategoria` de filtro.
- Nenhuma mudança em `sync.server.ts`, endpoints, migrações ou permissões.

### Nota sobre o efeito visível

O Demonstrativo agrega por `categoria_external_id` direto de `ca_contas_pagar`/`ca_contas_receber` — não lê `ca_lancamento_rateios`. O reprocessamento corrige as fatias daqueles lançamentos, mas o valor da própria linha do Demonstrativo não muda. Quem reflete a correção é a Análise por Centro de Custo, que consome os rateios.

### Fora de escopo

- Não altera a UI/fluxo do `/financeiro-op/conta-azul` (recortes 2026 / histórico continuam iguais).
- Não altera a lógica de `buildRateios`/`finalizarFatias` no servidor.
- Não mexe em receitas do estoque (`stock:*`), que não têm rateio no Conta Azul — para essas o botão fica oculto.