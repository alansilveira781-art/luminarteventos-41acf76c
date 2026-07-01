## Ajuste: Demonstrativo com mesma altura e rolagem dos Lançamentos

**Arquivo:** `src/components/financeiro/ContaAzulDashboard.tsx`

**Contexto:** Hoje o card "Lançamentos" tem altura fixa (`max-h-[600px]`) com rolagem vertical, enquanto o card "Demonstrativo" cresce livremente conforme o número de linhas — ficando visualmente desalinhado com o card ao lado, tanto no **Painel Financeiro** (linhas ~399–449) quanto na **Análise Detalhada** (linhas ~852–901).

**Alteração:**

1. **Painel Financeiro (linha ~407):** envolver o container das linhas do DRE com `max-h-[600px] overflow-y-auto` (mesma altura/rolagem do bloco de lançamentos logo ao lado).
2. **Análise Detalhada (linha ~859):** aplicar o mesmo `max-h-[600px] overflow-y-auto` no container das linhas do DRE.
3. Manter o cabeçalho ("Demonstrativo / Valores / %") fixo fora da área rolável — só a lista de linhas rola, replicando exatamente o comportamento do card de Lançamentos.

Sem mudanças em lógica, cálculos, cores ou colunas.
