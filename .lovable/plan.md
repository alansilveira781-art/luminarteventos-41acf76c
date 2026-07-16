## Filtro por Categoria — aba Estoque

Adicionar um filtro por Categoria na página `/estoque` (arquivo `src/routes/estoque.index.tsx`), ao lado dos filtros já existentes (busca, período, ocultar zerados).

### Comportamento
- Novo `Select` "Categoria" com as opções derivadas dinamicamente da lista de itens carregados (valores únicos do campo `categoria`, ordenados alfabeticamente).
- Opção padrão "Todas as categorias".
- Ao selecionar uma categoria, a listagem/tabela passa a exibir apenas os itens daquela categoria.
- Combina com os demais filtros (busca textual, período, ocultar sem estoque) — aplicados em conjunto.
- Reset de página para 1 ao alterar o filtro.

### Detalhes técnicos
- Estado local: `const [categoriaFilter, setCategoriaFilter] = useState<string>("all")`.
- Lista de categorias via `useMemo` sobre `itens`: `Array.from(new Set(itens.map(i => i.categoria).filter(Boolean))).sort()`.
- Aplicar `categoriaFilter !== "all" && i.categoria === categoriaFilter` no pipeline de filtros existente.
- UI usando `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` de `@/components/ui/select`, coerente com o estilo da página.

Somente alterações de frontend em `src/routes/estoque.index.tsx`. Nenhuma mudança de schema ou backend.