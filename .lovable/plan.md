## Objetivo

Na tela `src/routes/financeiro-op.conta-azul.tsx`, o único botão de sincronização chama o endpoint com `modo: "incremental"`. Depois da primeira sincronização bem-sucedida, o incremental passa a retornar 0 registros, porque só busca o que foi alterado desde a última rodada. Lançamentos futuros também não são capturados. A correção é expor um segundo botão que dispara `modo: "completo"`, varrendo toda a janela de vencimento configurada na tela.

## Escopo

Alterações apenas na tela `src/routes/financeiro-op.conta-azul.tsx`. O servidor (`sync.server.ts`) já trata `modo: "completo"` corretamente e não será modificado.

## Mudanças

1. Refatorar `handleSync` para receber o modo como parâmetro:
   ```ts
   async function handleSync(modo: "incremental" | "completo") { ... }
   ```

2. No `fetch` para `/api/contaazul/sync`, enviar o parâmetro `modo` passado para a função, em vez do valor fixo `"incremental"`.

3. Substituir o botão único de sincronização por dois botões no card "Sincronizar dados":
   - **"Sincronizar novidades"** — botão principal, chama `handleSync("incremental")`.
   - **"Sincronização completa"** — botão com `variant="outline"`, chama `handleSync("completo")`.

4. Adicionar abaixo dos botões um texto explicativo:
   > "Use a completa para a primeira carga ou para trazer lançamentos futuros; a de novidades traz só o que mudou."

5. Garantir que, no modo `"completo"`, o body continue usando os campos `from` e `to` editáveis da tela (janela −6/+12 meses já configurada), para que a sincronização completa varra toda a faixa de vencimento, incluindo futuro.

## Fora de escopo

- Nenhuma alteração em `src/lib/conta-azul/sync.server.ts`.
- Nenhuma alteração nos filtros de data, mapeamento, rateios ou enriquecimento.
- Nenhuma alteração no cálculo dos defaults de `from`/`to`.