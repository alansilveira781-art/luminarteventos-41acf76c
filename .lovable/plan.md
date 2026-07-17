# Plano: incluir lançamentos futuros na sincronização do Conta Azul

## O que será alterado

Atualizar o cálculo do estado inicial `from/to` em `src/routes/financeiro-op.conta-azul.tsx` para que a janela padrão de sincronização cubra tanto o passado quanto o futuro, garantindo que parcelas com vencimento futuro (ex.: compras parceladas em 12x) sejam sincronizadas.

## Mudança técnica

No `useState` das linhas 38–44:

- `from`: passar de 90 dias atrás para 6 meses atrás.
- `to`: passar de "hoje" para 12 meses à frente de hoje.

Exemplo da implementação:

```ts
const [defaults] = useState(() => {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - 6);
  const to = new Date(today);
  to.setMonth(to.getMonth() + 12);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
});
```

## O que NÃO será alterado

- Os campos `from` e `to` continuam editáveis para o usuário.
- Nenhuma outra lógica da tela, endpoints, mapeamento, rateios ou enriquecimento será modificada.

## Validação

Após a alteração, abrir a tela `/financeiro-op/conta-azul` e confirmar que os campos de data vêm preenchidos com a nova janela padrão (6 meses atrás → 12 meses à frente).