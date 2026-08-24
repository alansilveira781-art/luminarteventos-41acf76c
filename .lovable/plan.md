# Checkbox menor nos cards do quadro de Compras

O checkbox de seleção nos cards do Kanban de Compras está grande demais e desproporcional ao conteúdo do card.

## Mudança

- Reduzir o checkbox para 14x14 px (hoje usa o tamanho padrão, 16x16 com borda mais grossa), com o ícone de check proporcional.
- Ajustar o alinhamento vertical para ficar na mesma linha do título do card.

Nenhuma mudança de comportamento: seleção, ações em massa e clique no card continuam iguais.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: adicionar `className="h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"` no `<Checkbox>` do card e trocar o wrapper `pt-0.5` por `pt-[3px]`.
