# Corrigir crash no Inventário de Patrimônio

## Causa provável

Na tela `/patrimonio` (Inventário) e em outras telas com filtros + paginação, há um trecho assim:

```ts
useMemo(() => { setPage(1); }, [q, filterCat, ...]);
```

Isso usa `useMemo` para disparar um `setState` durante a renderização. Em React 19 esse padrão dispara o boundary de erro do TanStack Router quando algum dos filtros muda (por exemplo, ao restaurar valores salvos no `localStorage` pelo `usePersistedState`), resultando exatamente na tela "Something went wrong" que você está vendo.

O mesmo padrão aparece em 5 rotas:

- `src/routes/patrimonio.index.tsx`
- `src/routes/estoque.index.tsx`
- `src/routes/entradas.tsx`
- `src/routes/saidas.tsx`
- `src/routes/devolucoes.tsx`

## Correção

Trocar cada `useMemo(() => { setPage(1); }, [...])` por um `useEffect(() => { setPage(1); }, [...])`. Isso resolve o crash do Inventário e previne o mesmo problema nas outras 4 telas.

## Verificação

1. Abrir `/patrimonio` na pré-visualização e confirmar que o inventário carrega normalmente.
2. Mudar filtros (busca, categoria, estado, período) e confirmar que a página volta para a 1 sem erro.
3. Repetir um teste rápido em Estoque, Entradas, Saídas e Devoluções.