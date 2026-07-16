## Objetivo
No gráfico de Gantt de eventos (`/eventos`), o nome do evento na coluna fixa "Evento" está sendo cortado. Vamos deixar o nome mais visível sem alterar a estrutura do componente.

## Alterações propostas

1. **Aumentar a largura da coluna "Evento"**
   - Alterar a constante `LEFT_COL` de `210px` para `280px` em `src/components/eventos/GanttEventos.tsx`.

2. **Diminuir o tamanho da fonte do nome do evento**
   - Trocar a classe do nome do evento de `text-sm` para `text-xs`.

3. **Permitir quebra de linha controlada**
   - Remover `truncate` do nome.
   - Adicionar `whitespace-normal`, `leading-tight` e `line-clamp-2` para exibir até duas linhas.
   - Manter o atributo `title={ev.nome}` como fallback para nomes muito longos.

4. **Ajustar a altura da linha**
   - Aumentar `rowHeight` de `56px` para `64px` para acomodar o texto em duas linhas sem esmagar as barras do Gantt.
   - Reposicionar levemente as barras internas (`top`) se necessário para manter o alinhamento vertical.

## Escopo
- Apenas `src/components/eventos/GanttEventos.tsx`.
- Nenhuma alteração em dados, backend ou outras páginas.

## Resultado esperado
A coluna "Evento" fica mais larga, o texto do evento fica menor e pode quebrar em até duas linhas, reduzindo o corte de nomes longos.