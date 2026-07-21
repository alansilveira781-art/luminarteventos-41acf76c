## Problema

No diálogo **Validar recebimento** dos cards de **Compra** em `/estoque/a-receber`, o rótulo aparece como `COMPRA-—` (sem número), enquanto o card de **Despesa** mostra corretamente `DESPESA-170`. A causa é que o badge (`src/routes/estoque.a-receber.tsx`, linha 478) depende de uma segunda consulta assíncrona (`compra-receber-info`) para renderizar o número, e nesse fluxo a query cai no fallback `"—"` (loading ou dado ausente para esse `compraId`).

O card da listagem já conhece o `numero` (consulta principal `compras-receber` na linha 79), então basta passar esse valor como prop ao diálogo e usá-lo diretamente no rótulo — assim o badge fica idêntico ao do card, independente do estado da consulta interna.

## Mudanças (apenas UI, escopo mínimo)

Arquivo: `src/routes/estoque.a-receber.tsx`

1. **Passar `numero` como prop ao abrir o diálogo de compra**
   - Linha ~190: `<ReceberDialog compraId={openId} ... />` → também passar `compraNumero={compras.find(c => c.id === openId)?.numero ?? null}`.
   - Ajustar a assinatura de `ReceberDialog` (linha 215) para aceitar `compraNumero: number | null`.

2. **Usar a prop no badge do cabeçalho**
   - Linha 478: trocar `COMPRA-{compra?.numero ?? "—"}` por `COMPRA-{compraNumero ?? compra?.numero ?? "—"}` para garantir exibição imediata.

3. **Mesmo tratamento nas observações do recebimento** (para consistência)
   - Linha 396: usar `compraNumero ?? compra?.numero` na string `COMPRA-...`.

4. **Espelhar o padrão em Despesa (defensivo, sem alterar comportamento visível)**
   - Passar `demandaNumero` como prop ao `ReceberDemandaDialog` e usá-lo no badge (linha 1068) e na origem (linha 997), garantindo que ambos os fluxos usem exatamente a mesma fonte do card.

Não há alterações de RLS, banco, queries de dados ou lógica de negócio — só encaminhamento do `numero` que já é conhecido no momento do clique.

## Validação

- Abrir um card de compra em `/estoque/a-receber` e confirmar que o cabeçalho exibe `COMPRA-<numero>` imediatamente.
- Repetir com um card de despesa para confirmar que continua exibindo `DESPESA-<numero>`.
- Conferir que o texto de observação da entrada gerada contém `COMPRA-<numero>` correto.