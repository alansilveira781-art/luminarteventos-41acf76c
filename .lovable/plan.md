## Diagnóstico (confirmado no banco)

Ao criar um evento novo, a tela chama a função `proximo_codigo_evento`, que gera o código contando quantos eventos já existem naquele mês: `AAAAMM` + (contagem + 1).

Para julho/2026 já existem 9 eventos e os códigos vão de `20260701` até `20260710` (há buracos: falta o `...09`? não — existem 10 códigos para 9 eventos porque um evento de outro mês usou a numeração). Resultado: a função devolve `20260710`, que **já está em uso**, e o banco recusa o registro por código duplicado (o campo `codigo` é único).

O aplicativo captura esse erro e mostra a mensagem enganosa "Já existe um evento com este nome e local nesta data final" — por isso parece que o evento é duplicado quando na verdade é só o código que colidiu. O mesmo acontece em agosto (`20260810` já existe com 9 eventos no mês).

Segundo ponto: o insert não preenche o campo `codigo_evento` (o texto "31.07.2026 - ATIVAÇÃO RIOMAR - RIOMAR FORTALEZA" usado nas listas de outros módulos). Hoje nenhum gatilho do banco o preenche, então eventos novos ficariam sem esse identificador e não apareceriam nos seletores de evento dos demais módulos.

## O que fazer

1. **Gerar o código de forma segura (banco)**
   - Reescrever `proximo_codigo_evento` para pegar o maior sufixo já existente no mês (em vez de contar registros) e, se ainda assim houver conflito, avançar até achar um código livre.
2. **Preencher `codigo_evento` automaticamente (banco)**
   - Recriar o gatilho que monta `codigo_evento` a partir da data final + nome + local, em inserção e atualização, garantindo que todo evento novo apareça nas listas dos outros módulos.
3. **Mensagem de erro correta (frontend, `src/routes/eventos.index.tsx`)**
   - Diferenciar o conflito de código do conflito de nome/local e, no caso de código duplicado, tentar novamente uma vez antes de exibir erro.
   - Mostrar a mensagem real do banco quando não for um caso conhecido, para facilitar diagnósticos futuros.

## Resultado esperado

O evento "31.07 a 23.08.2026 — ATIVAÇÃO RIOMAR DIA DOS PAIS — RIOMAR FORTALEZA" passa a salvar normalmente, com código único e identificador visível nos seletores de evento de todos os módulos.
