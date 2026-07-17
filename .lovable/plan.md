## Objetivo
Corrigir o erro 400 do Conta Azul no modo incremental, que hoje omite `data_vencimento_de/ate`. A API exige essa janela sempre; o filtro por alteração é adicional.

## Alteração única
Arquivo: `src/lib/conta-azul/sync.server.ts`, funções `syncContasPagar` e `syncContasReceber`.

1. Adicionar duas constantes locais (topo do arquivo, próximo aos helpers de data) para a janela ampla usada no modo incremental:
   - `INCREMENTAL_VENC_MESES_PASSADO = 12`
   - `INCREMENTAL_VENC_MESES_FUTURO = 12`
   E um helper `janelaVencimentoIncremental()` que devolve `{ from: hoje-12m, to: hoje+12m }` no formato `YYYY-MM-DD`.

2. Nos blocos incrementais das duas funções, substituir:
   ```ts
   incremental
     ? { data_alteracao_de: toCaDateTime(desdeAjustado!), data_alteracao_ate: toCaDateTime(agoraIso) }
     : { data_vencimento_de: from, data_vencimento_ate: to }
   ```
   por:
   ```ts
   const params = incremental
     ? {
         data_vencimento_de: janela.from,
         data_vencimento_ate: janela.to,
         data_alteracao_de: toCaDateTime(desdeAjustado!),
         data_alteracao_ate: toCaDateTime(agoraIso),
       }
     : { data_vencimento_de: from, data_vencimento_ate: to };
   ```
   onde `janela = janelaVencimentoIncremental()`.

3. Garantir que `toCaDateTime` produza `YYYY-MM-DDTHH:mm:ss` sem milissegundos nem `Z` (cortando após o segundo). Ajustar o helper se hoje ainda inclui `.sss` ou `Z`.

4. Modo completo permanece exatamente como está (só `data_vencimento_de/ate` a partir de `from/to` do usuário, sem `data_alteracao_*`).

## Fora de escopo
Enriquecimento, rateios, mapeamento, reconciliação de exclusões, UI, endpoints, migração.
