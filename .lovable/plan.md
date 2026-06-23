# Painel de Vendas — correções para funcionar efetivamente

A página `src/routes/comercial.dashboard.painel.tsx` já contém todos os elementos descritos (filtros Empresa/Ano/Mês, 4 KPIs com Período Anterior + % LY colorido, Evolução por Trimestre, Ticket Médio com eixo duplo, Ranking Consultores, Valor por Classificação e Gauge Real vs Meta). O banco também tem 1.049 vendas válidas entre 2022 e 2026. O problema é que a página fica visualmente "vazia" por 3 causas reais:

## Causas identificadas

1. **Filtros ocultos continuam ativos.** O Painel só expõe `Empresa / Ano / Mês`, mas `applyFilters` aplica também `consultor` e `classificacao` vindos do `usePersistedState("comercial.dashboard.filtros.v4")`. Se em outra aba (Relatórios/Vendedores) o usuário deixou um consultor/classificação selecionado, ao voltar para o Painel tudo é filtrado a zero sem nenhuma pista visual.
2. **`comercial_metas` está vazia** (0 linhas). O gauge `Real. VS Meta` calcula meta = 0 → o arco fica vazio e mostra "0,0% da meta", parecendo que o componente está quebrado.
3. **Fallback de ano só dispara quando `ano !== "Todos"`.** Se o estado persistido vier com `ano: "Todos"`, o painel mostra a soma agregada (correto), mas o gauge sem meta confunde. E se vier `ano: 2025` o fallback funciona — ok aqui.

## Correções

### 1. `src/routes/comercial.dashboard.painel.tsx`
- Antes de renderizar, normalizar os filtros invisíveis para o Painel: ao montar a página, se `filtros.consultor !== "Todos"` ou `filtros.classificacao !== "Todos"` ou `filtros.trimestre !== "Todos"`, resetar esses três para `"Todos"` (mantendo Empresa/Ano/Mês). Isso garante que o Painel só responde aos 3 filtros visíveis.
- Default de Ano: se `filtros.ano === "Todos"` e existe o ano corrente nos dados, selecionar o ano corrente (hoje 2026). Mantém comportamento atual de fallback para o último ano com dados.

### 2. `src/components/comercial/dashboard/GaugeRealVsMeta.tsx`
- Quando `meta <= 0`, em vez de mostrar arco vazio, exibir estado claro: "Nenhuma meta cadastrada para o período" com um link/CTA "Cadastrar metas" apontando para `/comercial/metas`. Continua mostrando o realizado no centro.
- Quando há meta, manter o gauge como está.

### 3. `src/routes/comercial.dashboard.painel.tsx` (gauge)
- Passar a prop `ano` e `mes` selecionados para o gauge, e quando `metas.length === 0` repassar `meta = 0` (já é o caso) — o componente do passo 2 cuida da UX.

## Não muda

- Cálculo de KPIs, % LY (Last Year = ano-1 mesmo mês/empresa), Período Anterior — confirmado correto pelo usuário.
- Fonte da meta continua sendo `comercial_metas` (somando por ano e, se houver mês, pelo mês).
- Layout, ícones, cores, ordem dos cards e gráficos permanecem como hoje.

## Detalhes técnicos

- `applyFilters` em `src/lib/comercial/vendas-metrics.ts` não muda; o saneamento acontece no componente da rota, mantendo o contrato compartilhado com as outras abas (Relatórios, Vendedores, Indicadores) intacto.
- O reset é feito uma única vez por montagem com `useEffect`, comparando os campos atuais e chamando `setFiltros({ ...filtros, consultor: "Todos", classificacao: "Todos", trimestre: "Todos" })`.
- O CTA do gauge usa `<Link to="/comercial/metas">` (rota já existente).

## Arquivos alterados

- `src/routes/comercial.dashboard.painel.tsx`
- `src/components/comercial/dashboard/GaugeRealVsMeta.tsx`
