## Objetivo

Duas mudanças independentes no módulo Conta Azul:
1. **Sync incremental por `data_alteracao`** — trazer só o que foi criado/editado desde a última sincronização OK.
2. **Simplificar a tela `financeiro-op.conta-azul`** — deixar só Conexão e Sincronização.

---

## Parte 1 — Sync incremental

### `src/lib/conta-azul/sync.server.ts`

- Nova função `ultimoSyncOk(recurso: "contas_pagar" | "contas_receber"): Promise<string | null>`  
  Consulta `ca_sync_log` pelo maior `finished_at` com `status='ok'` e `recurso=<recurso>`. Retorna ISO ou `null`.
- `syncContasPagar(from, to, desde?)` e `syncContasReceber(from, to, desde?)`:
  - Se `desde` informado (modo incremental):
    - No `fetchPaged`, trocar `data_vencimento_de/ate` por `data_alteracao_de: desde` e `data_alteracao_ate: <agora ISO>` (formato `YYYY-MM-DDTHH:mm:ss`).
    - Aplicar margem de segurança: subtrair 10 min de `desde` antes de enviar.
    - **Pular** `reconciliarExclusoes` (só roda no modo completo — janela por vencimento é o critério dela).
    - Passar `modo=incremental desde=<ts>` para `logFinish` via `mensagem`.
  - Se `desde` ausente: comportamento atual (janela `from/to` + reconciliação). Mensagem: `modo=completo`.
- Enrichment, rateios, mapeamento e upsert seguem iguais — só muda o conjunto que chega até eles.

### `src/routes/api/contaazul/sync.ts`

- Estender schema Zod com `modo: z.enum(["incremental","completo"]).optional()` (default `"incremental"`).
- Quando `recurso` é `contas_pagar` / `contas_receber` / `tudo`:
  - `incremental`: chamar `ultimoSyncOk(recurso)`; se existir, chamar sync com `desde`. Se não existir (primeira vez), fallback para completo com `from/to`.
  - `completo`: comportamento atual.
- `syncTudo`: quando modo incremental, passa `desde` para pagar/receber; plano_contas, centros_custo e extrato continuam iguais (extrato usa janela porque não tem filtro de alteração).

### `src/routes/financeiro.conta-azul.tsx` (tela principal de sync)

- Botão primário passa a mandar `modo: "incremental"` — rótulo **"Sincronizar novidades"**.
- Novo botão secundário **"Sincronização completa"** → manda `modo: "completo"` com a janela `from/to`. Mantém o aviso atual para janela > 120 dias apenas neste modo.

---

## Parte 2 — Enxugar `src/routes/financeiro-op.conta-azul.tsx`

Deixar apenas **card Conexão** + **card Sincronização**.

Remover:
- Da renderização: `<SyncAutomaticoCard>`, `<CargaHistoricaCard>`, `<ReprocessarFalhasCard>`, `<SyncStateCard>` e o `<Card>` inline com o histórico de logs (bloco contíguo).
- Definições órfãs: funções `SyncAutomaticoCard`, `CargaHistoricaCard`, `ReprocessarFalhasCard`, `SyncStateCard`.
- `useQuery` `logs` (usado só pela tabela removida) e estados que ficarem sem uso.
- Imports que ficarem sem referência.

Não mexer em `financeiro.conta-azul.tsx` nem em nada de `src/lib/conta-azul/`. Endpoints backend permanecem — só saem da UI desta aba.

---

## Fora de escopo

- Refatorar `enrichItemsWithDetail` / rateios / mapeamento.
- Alterar sync de plano de contas, centros de custo, extrato.
- Schema / RLS / OAuth.
