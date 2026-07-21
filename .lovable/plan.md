## Ajuste no Calendário Público: botão "Voltar para os módulos"

### Contexto
A rota `src/routes/calendario-publico.tsx` já possui a lógica de autorização: usuários logados que são admin, têm acesso ao módulo `eventos` ou têm a flag `is_expectador_eventos` veem o calendário. O usuário quer que esses usuários autorizados (admins/editores) tenham um botão para voltar aos módulos internos, enquanto mantém a visualização pública limpa para telas/TVs quando não logado.

### Alterações
1. **Adicionar botão de retorno no cabeçalho**
   - Arquivo: `src/routes/calendario-publico.tsx`
   - Local: dentro do `return` principal (quando `autorizado` é true), na linha do cabeçalho ao lado do título.
   - Implementação: usar `<Link to="/">` do TanStack Router com texto "← Voltar para os módulos".
   - Estilo: `Button variant="outline" size="sm"` ou similar, posicionado à direita no desktop e acima/abaixo no mobile (flex-col em sm).

2. **Garantir responsividade**
   - Ajustar o container do cabeçalho para `items-start sm:items-center` e permitir quebra de linha, mantendo o relógio visível.

### Fora de escopo
- Não alterar a tela de acesso negado (ela já tem um botão "Voltar" para `/`).
- Não alterar cores do Gantt nem do diálogo de detalhes neste ajuste.

### Validação
- Verificar no preview que usuários logados/autorizados veem o botão e que ele navega para `/`.
- Verificar que a visualização pública (não logada) permanece sem o botão.