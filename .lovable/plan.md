## Adicionar "Pro Labore" ao tipo de despesa

Editar `src/lib/demandas.ts` incluindo em `TIPO_DEMANDA_OPTIONS`:

```ts
{ value: "pro_labore", label: "Pro Labore" },
```

A opção aparecerá automaticamente no seletor "Tipo de despesa" do `DemandaDialog` (usado no Quadro de Despesas) e será rotulada corretamente nos relatórios/dashboards que leem essa lista.

Nenhuma outra alteração é necessária — o valor é um texto livre na coluna `tipo_demanda`, sem enum no banco.