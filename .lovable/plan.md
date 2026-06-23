## Diagnóstico

- A consulta do dashboard está paginando corretamente: busca lotes de 1.000 registros até acabar.
- Hoje existem **1.050 vendas** em `comercial_vendas`, então o painel deveria formar as análises com todos esses registros.
- Distribuição atual por ano-base:
  - 2026: 83 vendas / R$ 6,89 Mi
  - 2025: 169 vendas / R$ 9,49 Mi
  - 2024: 273 vendas / R$ 7,49 Mi
  - 2023: 229 vendas / R$ 5,06 Mi
  - 2022: 227 vendas / R$ 3,97 Mi
  - 1900: 69 vendas / R$ 1,78 Mi
- O motivo mais provável do painel continuar zerado é que filtros salvos no navegador ainda são carregados depois da tela montar. O reset atual roda só uma vez, antes do valor salvo ser hidratado, então filtros invisíveis podem voltar e zerar tudo.

## Plano de correção

1. **Corrigir a normalização dos filtros do Painel de Vendas**
  - Ajustar `src/routes/comercial.dashboard.painel.tsx` para resetar `consultor`, `classificacao` e `trimestre` sempre que eles voltarem do estado persistido.
  - Manter apenas os filtros visíveis do painel: Empresa, Ano e Mês.
2. **Garantir um ano válido com dados**
  - Se `Ano = Todos`, selecionar automaticamente o ano mais recente com dados válidos.
  - Se o ano salvo não existir mais nos dados, cair para o ano mais recente com vendas.
3. **Adicionar um resumo operacional discreto no topo**
  - Mostrar quantas vendas foram carregadas no total e quantas estão sendo usadas após os filtros.
  - Exemplo: `1.050 vendas carregadas · 83 no filtro atual`.
  - Isso responde diretamente se a paginação está puxando tudo e facilita diagnóstico futuro.
4. **Evitar a tela “tudo zerado” sem explicação**
  - Se houver registros carregados, mas nenhum passar pelos filtros, exibir mensagem clara para limpar/ajustar filtros em vez de cards zerados sem contexto.
5. **Validar no preview**
  - Abrir `/comercial/dashboard/painel` e confirmar que os KPIs aparecem com valores reais e que o contador mostra a quantidade de registros considerada.
6. **Dupla conferência**
  - Verificar se estão aparecendo os filtros corretamente, principalmente de ano e empresa;
  - Verificar se está pegando as informações da tabela correta comercial_vendas;
  - Olhar se e validar se tem algum bug de informação dentro dessa tabela;