Objetivo

No relatório "Distribuição de Comissão" (aba Relatórios do Comercial), alterar o filtro de ano/mês para usar a data de REGISTRO da venda (dataRegistro), não a data do evento (dataEvento). Isso garante que uma venda registrada em junho, mas com evento em agosto, apareça corretamente no filtro de junho.

Escopo

- Arquivo único: src/routes/comercial.relatorios.tsx
- Nenhuma alteração em vendas-metrics.ts (getAno/getMes continuam usados por outros dashboards/relatórios)
- Nenhuma alteração no relatório "Vendas por Período"
- Nenhuma alteração em outros módulos

Implementação

1. Adicionar helpers locais após const rows = data?.rows ?? []:
   - MESES_PT com nomes em minúsculo
   - anoDoRegistro(r): extrai ano de dataRegistro, com fallback para dataEvento e depois getAno
   - mesDoRegistro(r): extrai mês de dataRegistro, com fallback para getMes

2. Substituir o useMemo de anosDisponiveis para usar anoDoRegistro(r) em vez de getAno(r).

3. Substituir o useMemo de filtradas para usar anoDoRegistro(r) e mesDoRegistro(r) em vez de getAno/getMes.

4. Adicionar eslint-disable-next-line react-hooks/exhaustive-deps nos useMemo que referenciam helpers locais (anoDoRegistro/mesDoRegistro), conforme instrução do prompt.

Validação

- Typecheck e build passam.
- Testar na aba Relatórios > Distribuição de Comissão: filtrar junho/2026 deve exibir vendas registradas em junho, mesmo que o evento seja em outro mês.
- Confirmar que o relatório "Vendas por Período" continua inalterado.