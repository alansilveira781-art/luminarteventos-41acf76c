# Adicionar acesso do Assistente à base de Uber

O Assistente Claude atualmente responde que não tem acesso à tabela `uber_corridas`, mas ela existe no sistema. Vamos expor esses dados como uma nova ferramenta de leitura para o assistente.

## O que vamos fazer

1. **Nova ferramenta `consultar_uber`** em `src/lib/assistente/ferramentas.server.ts`
   - Consulta a tabela `uber_corridas`.
   - Filtros por período (`data_solicitacao`), nome, serviço, cidade, projeto/endereço e valor mínimo/máximo.
   - Retorna agregações úteis: total gasto, quantidade de corridas, agrupado por projeto/serviço.
   - Limite padrão de 500 registros, máximo 2000.

2. **Atualizar o prompt do sistema** em `src/routes/api/assistente/chat.ts`
   - Incluir `consultar_uber` na lista de ferramentas disponíveis.
   - Deixar claro que o assistente pode responder sobre gastos com Uber por período, projeto, colaborador ou evento.

3. **Ajustar o nome no frontend** (se necessário)
   - Verificar se `src/routes/assistente.tsx` precisa incluir a nova ferramenta na lista de nomes amigáveis exibidos durante a consulta.

## Resultado esperado

O usuário poderá perguntar coisas como:
- "Quanto gastamos com Uber em agosto?"
- "Quais corridas estão vinculadas ao evento X?"
- "Qual colaborador mais usou Uber no mês?"

O assistente consultará a tabela real e responderá com valores, sem pedir exportação manual.
