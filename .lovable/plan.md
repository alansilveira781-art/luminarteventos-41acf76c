## Ajustes de nomenclatura no Quadro de Despesas

### O que será feito
1. Adicionar o novo tipo **"Imobilizado"** (`imobilizado`) em `src/lib/demandas.ts`, sem nenhuma alteração no banco de dados.
2. Renomear o label do campo de **"Tipo de demanda"** para **"Tipo de Despesa"** em:
   - `src/components/DemandaDialog.tsx`
   - `src/routes/solicitar.tsx`
3. Renomear os labels exibidos dos status no kanban de Despesas em `src/lib/demandas.ts`:
   - "Solicitação de Demanda" → "Solicitação de Despesa"
   - "Demanda Aprovada" → "Despesa Aprovada"
   - "Demanda Em Andamento" → "Despesa Em Andamento"
   - "Demanda Negada" → "Despesa Negada"
4. Renomear o título do gráfico em `src/routes/financeiro.dashboard.tsx` de "Demandas por tipo (R$)" para "Despesas por tipo (R$)".

### O que NÃO será alterado
- Nenhuma migration será criada — o valor `imobilizado` será salvo como string na coluna `tipo_demanda` (texto).
- Os valores de status no banco (`solicitacao`, `aprovada`, `em_andamento`, `negada`, etc.) permanecem iguais; apenas os labels visuais mudam.
- `src/lib/compras.ts` (COMPRA_STATUSES) não será alterado.
- Os módulos Compras, Estoque, Comercial, Contábil, Patrimônio e RH não serão afetados.
- A coluna `tipo_demanda` no banco e em `src/integrations/supabase/types.ts` não será alterada.

### Arquivos que serão editados
- `src/lib/demandas.ts`
- `src/components/DemandaDialog.tsx`
- `src/routes/solicitar.tsx`
- `src/routes/financeiro.dashboard.tsx`

### Validação
- Busca de texto confirmou que não existem outras ocorrências de "Tipo de demanda" ou dos labels de status de demanda no código, garantindo que o ajuste seja completo e isolado.