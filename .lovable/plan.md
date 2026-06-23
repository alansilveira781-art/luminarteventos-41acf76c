## Objetivo

Unificar **Reformas** e **Construções** em uma única opção **Reformas & Construções** em todos os pontos onde aparecem (formulário de Demanda no quadro do Financeiro e site público `/solicitar`). Manter **Fardamento** como opção separada.

## Mudança

Em `src/lib/demandas.ts`, substituir as duas entradas:

```ts
{ value: "reformas", label: "Reformas" },
{ value: "construcoes", label: "Construções" },
```

por uma única:

```ts
{ value: "reformas_construcoes", label: "Reformas & Construções" },
```

Lista final do `TIPO_DEMANDA_OPTIONS` (6 itens, nessa ordem):

1. Estacionamento
2. Alimentação
3. Manutenção do Galpão
4. Manutenção de Veículos
5. Fardamento
6. Reformas & Construções

## Impacto

Como `TIPO_DEMANDA_OPTIONS` é a única fonte usada por:

- `src/components/DemandaDialog.tsx` (form do quadro de Despesas/Demandas)
- `src/routes/solicitar.tsx` (site público)
- `src/routes/financeiro.dashboard.tsx` (mapa de labels para o dashboard)

a alteração em um único arquivo cobre os três lugares automaticamente.

## Compatibilidade com dados antigos

Demandas já salvas com `tipo_demanda = "reformas"` ou `"construcoes"` continuam no banco intactas (nenhuma migração). Para que essas demandas antigas ainda exibam um rótulo legível no dashboard, adiciono um fallback no `TIPO_DEMANDA_LABEL` (mapa derivado) que reconhece os valores legados `reformas` e `construcoes` e devolve `"Reformas & Construções"`. No `<Select>` do form, demandas antigas com esses valores aparecerão sem seleção visível até o usuário escolher a nova opção combinada — comportamento aceitável e sem perda de dado.

## Não fazer

- Não alterar `Fardamento` nem os outros 4 tipos.
- Não rodar migração nem reescrever registros existentes.
- Não mexer em permissões, no módulo de Compras, ou em qualquer outra lógica.
