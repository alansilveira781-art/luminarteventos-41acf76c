## Adicionar "Manutenção de Maquinário" no tipo de demanda

Adicionar a opção em `src/lib/demandas.ts` na constante `TIPO_DEMANDA_OPTIONS`:

```ts
{ value: "manutencao_maquinario", label: "Manutenção de Maquinário" },
```

Isso já propaga automaticamente para:
- **Quadro de Despesas** (`/financeiro`) via `DemandaDialog`, que lê `TIPO_DEMANDA_OPTIONS`.
- **Link de Solicitar** (`/solicitar`) que também importa `TIPO_DEMANDA_OPTIONS` (linhas 314 e 765).
- **Dashboard Financeiro** que usa as mesmas labels.

A coluna `tipo_demanda` na tabela `demandas` é `text` livre — sem enum/constraint no banco — então nenhuma migração é necessária.

Nenhuma alteração de regras de negócio, permissões ou layout.