## Diagnóstico

O "2/2 - STAND WIND 2/2" aparece duplicado porque:
- `f3b62bf3-...` foi sincronizado em **15/06/2026** (`em_aberto`)
- `f4376b6f-...` foi sincronizado em **08/07/2026** (`pago`)

No Conta Azul só existe o segundo — o primeiro foi excluído/substituído lá. Mas o sync do app faz apenas `upsert` (`syncContasPagar`, `syncContasReceber`, `persistRateios` em `src/lib/conta-azul/sync.server.ts`), sem detectar exclusões. Toda vez que um lançamento é apagado no CA, ele fica como fantasma no nosso banco e infla os totais do dashboard.

## Correção

**Reconciliação por range em cada sync.** Para cada janela `from..to` que o sync consulta na API do CA, montar o `Set<external_id>` do que a API retornou e apagar do banco os registros dessa mesma janela que **não** estão no Set. Aplica em `ca_contas_pagar`, `ca_contas_receber` e cascateia para `ca_lancamento_rateios`.

### Alterações em `src/lib/conta-azul/sync.server.ts`

1. **`syncContasPagar(from, to)`** — depois do `upsertBatched`, executar:
   ```ts
   const activeIds = new Set(items.map((it: any) => String(it.id)));
   const { data: existentes } = await sb
     .from("ca_contas_pagar")
     .select("external_id")
     .gte("data_vencimento", from)
     .lte("data_vencimento", to);
   const toDelete = (existentes ?? [])
     .map((r: any) => r.external_id)
     .filter((id: string) => !activeIds.has(id));
   if (toDelete.length > 0) {
     // apaga rateios primeiro (FK lógica), depois o pai
     await sb.from("ca_lancamento_rateios")
       .delete().eq("tipo", "pagar").in("lancamento_external_id", toDelete);
     await sb.from("ca_contas_pagar")
       .delete().in("external_id", toDelete);
     await logInfo("contas_pagar_reconciliacao", `${toDelete.length} registros removidos (excluídos no CA)`);
   }
   ```
2. **`syncContasReceber(from, to)`** — idem para `ca_contas_receber` + rateios `tipo='receber'`.
3. Fazer log em `ca_sync_log` com o `recurso: "reconciliacao_pagar"` / `"reconciliacao_receber"` e a lista de external_ids removidos (ou só a contagem, se ficar grande).

### Limpeza imediata (uma vez)

Migration ou `supabase--insert` para remover **agora** os fantasmas conhecidos no range já sincronizado, sem esperar o próximo cron. Estratégia segura: rodar a mesma lógica para o range `[data mínima, hoje]` na próxima execução do sync — basta rodar manualmente uma vez pelo botão de sync após deploy. Não precisa migration.

Alternativa mais agressiva: deletar diretamente o `f3b62bf3-...` agora via `supabase--insert`, mas o correto é confiar na reconciliação automática rodando um sync do mês de junho.

## Fora de escopo

- Detectar mudanças de `data_vencimento` que movam o lançamento para fora do range: coberto naturalmente porque o próximo sync do range novo vai encontrar o registro; e o range antigo vai apagá-lo, mas o external_id ainda existe — **risco**: se o CA mover um lançamento de junho para agosto, o sync de junho vai apagar e o sync de agosto vai recriar. Isso é aceitável (temporariamente somem, reaparecem no próximo cron). Se for preocupação, adicionar checagem: só apagar se o external_id não existe em **nenhum** range recente. Fica para depois.
- Interface manual para "ignorar" lançamentos (plano anterior descartado — o problema é sync, não usuário).

## Verificação

1. Rodar sync manual do mês 06/2026 (contas a receber).
2. Consultar: `SELECT external_id FROM ca_contas_receber WHERE descricao ILIKE '%STAND WIND 2/2%'` — deve retornar só `f4376b6f-...`.
3. Recarregar o dashboard: "Receita sobre Stand" mostra 1 linha só de R$ 36.500.
4. Log em `ca_sync_log` mostra a reconciliação com 1 registro removido.
