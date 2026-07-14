
## Objetivo

Ajustes na aba Contábil (Notas Fiscais, Recebimentos e Apurações).

## 1. Campo Evento nos formulários

**Notas Fiscais (`src/routes/contabil.notas.tsx`)**
- Adicionar campo "Evento" (input de texto) no `NotaForm`, mapeado para a coluna já existente `nome_evento`. Enviar no payload de insert/update.
- Exibir uma coluna "Evento" na tabela de notas.

**Recebimentos (`src/routes/contabil.recebimentos.tsx`)**
- Hoje o evento aparece só derivado da NF vinculada. Adicionar no `RecebimentoForm` um campo "Evento" (input texto) mapeado para uma nova coluna `nome_evento` em `contabil_recebimentos` (migration necessária — coluna text nullable).
- Ao selecionar uma NF vinculada, pré-preencher com `nota.nome_evento` (permitindo editar).
- Coluna "Evento" da tabela passa a mostrar `r.nome_evento ?? nota?.nome_evento`.

## 2. Ordenação por clique nas colunas

Usar o utilitário existente `SortableTh` / `useSort` (`src/components/SortableTh.tsx`) que já implementa o ciclo pedido: 1º clique = desc, 2º = asc, 3º = sem ordenação.

Aplicar em:
- Tabela de Notas Fiscais: Data, Número, Empresa, Tomador, Evento, Bruto, Líquido, Status.
- Tabela de Recebimentos: Data, Empresa, Nº NF, Evento, Banco, Valor recebido.

## 3. Filtro por mês (default: mês anterior)

Adicionar `PeriodoFilter` (`src/components/PeriodoFilter.tsx`) no topo de **Notas Fiscais** e **Recebimentos**, preset default `mes` com `periodo = periodoDoMes(subMonths(new Date(), 1))` para abrir sempre no **mês anterior ao atual**.

- Notas filtram por `data_emissao`.
- Recebimentos filtram por `data_recebimento`.
- Preset persistido via `usePersistedState` para lembrar entre sessões.

## 4. Correção do Nº NF na Apuração

Em `contabil.apuracoes.tsx`, quando o regime é "caixa" a coluna Nº NF só usa `r.numero_nf`, que muitas vezes está em branco quando a NF foi vinculada via `nota_id`. Corrigir para:

```
r.numero_nf ?? (r.nota_id && notasMap?.map.get(r.nota_id)?.numero) ?? "—"
```

Mesma lógica já usada para o Evento na mesma tabela. Assim o Nº NF é sempre puxado dos recebimentos (com fallback para a NF vinculada).

## Detalhes técnicos

**Migration**
```sql
ALTER TABLE public.contabil_recebimentos ADD COLUMN nome_evento text;
```

**Arquivos alterados**
- `src/routes/contabil.notas.tsx` — campo evento no form, coluna evento, SortableTh, PeriodoFilter.
- `src/routes/contabil.recebimentos.tsx` — campo evento no form, SortableTh, PeriodoFilter, coluna evento com fallback.
- `src/routes/contabil.apuracoes.tsx` — fallback do Nº NF via `notasMap`.
- `src/integrations/supabase/types.ts` — regenerado após a migration.

## Fora de escopo

- Cálculo de impostos, alíquotas, regime caixa/competência.
- Fluxo de outras abas do módulo.
