## Objetivo

Garantir que o Dashboard puxa os dados da MESMA base da aba Vendas e que cada filtro mostra exatamente as opções reais que aparecem em Vendas (ex.: Empresa = `EVENTO` e `PLANEJADOS`, sem valores fantasmas).

## Diagnóstico (base atual)

Consultei a tabela `comercial_vendas`. Hoje a base tem:

- **Empresa**: `EVENTO` (932), `PLANEJADOS` (117) e 1 linha NULL. Já filtra OK no Dashboard.
- **Ano**: vários registros com `ano_evento = 1900` (69 linhas, lixo de importação). Como `getAno` usa `r.anoEvento ?? r.ano ?? ...`, ele devolve `1900` e o filtro de Ano lista `1900` como uma opção válida.
- **Consultor**: aparece um valor literal `"-"` na base, além dos consultores reais (André, Cristiano, Gabi, Jefferson, Maicon, Padua, Romulo). O `"-"` polui o filtro.
- Mesmas situações pontuais podem ocorrer em `cerimonial`, `decorador`, `classificacao`, `mes_evento`.

Por isso o Dashboard “liga” na base correta, mas o usuário vê filtros estranhos que não batem com Vendas.

## Plano

Mudanças pontuais, sem mexer em Propostas, sem trocar a fonte (`listVendasDb`) e sem recalcular valores.

1. **Sanitizar derivações em `src/lib/comercial/vendas-metrics.ts`**
   - `getAno(r)`: aceitar apenas anos válidos (`> 1900` e `<= ano atual + 5`). Aplicar a TODAS as fontes (`anoEvento`, `ano`, `parseYear(dataEvento)`, `parseYear(dataRegistro)`), não só ao parse de string. Resultado: o ano `1900` deixa de aparecer no filtro e nas agregações.
   - Criar `cleanText(v)`: trata `null`, `""`, `"-"`, `"—"`, `"N/A"` como vazio.
   - Aplicar `cleanText` em `applyFilters` para consultor/empresa/classificacao/cerimonial/decorador (linhas com valor “lixo” não casam com nenhum filtro real).
   - `uniqueValues` ganha uma versão/uso que filtra via `cleanText`, garantindo dropdowns sem `"-"`, `""`, etc.

2. **`src/components/comercial/dashboard/FiltrosBar.tsx`**
   - Empresas/consultores/classificacoes/cerimoniais/decoradores: construir as opções com o helper sanitizado, idêntico ao critério da aba Vendas. Resultado prático: o filtro Empresa mostrará exatamente `EVENTO` e `PLANEJADOS`.
   - Anos: usar o novo `getAno` saneado. O ano fantasma `1900` some.
   - Manter o comportamento defensivo já existente: se o valor atual do filtro não está nas opções, exibir `Todos` (nunca campo vazio).

3. **`src/routes/comercial.dashboard.tsx`**
   - Manter a leitura via `useQuery({ queryKey: ["comercial-vendas-db"], queryFn: listVendasDb })` — mesma queryKey usada pela aba Vendas, então qualquer cadastro/edição já reflete (mais o realtime que já existe).
   - Confirmar que o fallback de ano padrão (ano atual → último ano com dados → "Todos") continua funcionando com o `getAno` saneado.

## Validação

- Filtro Empresa do Dashboard mostra apenas `EVENTO` e `PLANEJADOS` — igual a Vendas.
- Filtro Ano não mostra mais `1900`; ao abrir, mostra 2026 (atual). Se 2026 não tiver dados, cai para 2025 (último com dados).
- Filtro Consultor não mostra `"-"`; mostra só os nomes reais.
- Cadastrar/editar uma venda na aba Vendas atualiza o Dashboard sem F5.
- Propostas continua intocada.

## Não fazer

- Não reescrever Propostas.
- Não alterar a tabela `comercial_vendas` nem fazer backfill de dados.
- Não trocar a fonte de leitura nem a queryKey.
- Não recalcular valorFinal/valorBV/valorComissao.