## Objetivo

Substituir os campos "Subcategoria" (input livre) e a categoria fixa "IMOBILIZADO" no bloco "Itens a patrimoniar" (`src/routes/patrimonio.a-receber.tsx`) pelos mesmos controles usados no cadastro normal do Patrimônio (`src/routes/patrimonio.index.tsx` → `ItemDialog`).

## Alterações em `src/routes/patrimonio.a-receber.tsx`

1. **Constantes**: reaproveitar a lista `CATEGORIAS` (`["ACERVO","IMOBILIZADO","ILUMINACAO","ESTOQUE","MAQUINARIOS","FERRAMENTAS","VEICULOS","ESTRUTURAS","AMBIENTE","DECORACAO"]`) do cadastro; declarar localmente no arquivo.

2. **Tipo `LinhaPat`**: adicionar `categoria: string` (default `"IMOBILIZADO"`).

3. **`buildInitialLinhas`**: inicializar `categoria: "IMOBILIZADO"` em cada linha.

4. **Query de subcategorias existentes**: adicionar `useQuery` que busca `subcategoria` distinta em `pat_itens` (todas as categorias) para popular o Select — mesmo padrão do `ItemDialog`, mas em vez de derivar de `itens` na tela, buscamos do banco (o dialog atual não recebe a lista).

5. **UI da linha** — substituir os dois campos atuais:
   - **Categoria**: `Select` com as opções de `CATEGORIAS`, default `"IMOBILIZADO"`, com `onValueChange` atualizando `l.categoria`.
   - **Subcategoria**: `Select` com opções vindas da query + subcategorias adicionadas na sessão (`extraSubs` por linha), com botão `+` ao lado que abre input inline para criar nova (upper-case, "Enter" confirma). Espelhar exatamente o markup do `ItemDialog` (linhas ~461–497). Estado local: `extraSubs: Record<number,string[]>` mais `addingSub`/`newSub` por linha (ou um mapa indexado por `idx`).

6. **Insert na mutation `finalizar`**: trocar `categoria: "IMOBILIZADO"` fixo por `categoria: l.categoria || "IMOBILIZADO"`; `subcategoria` continua sendo `l.subcategoria || null`.

## Fora de escopo

- Persistir subcategorias em tabela própria (permanece derivada de `pat_itens`, como no cadastro).
- Alterações no `ItemDialog` do cadastro.
- Mudanças de schema.