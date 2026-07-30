## 1. Eventos — vários locais no mesmo evento (mesmo ID)

Hoje cada linha da tabela de eventos é um evento independente e o identificador `codigo_evento` (o texto `AAAAMMDD - NOME - LOCAL` que abastece o dropdown de eventos em todos os módulos) é montado por gatilho a partir do nome + local da própria linha. Por isso dois locais gerariam dois IDs diferentes.

Solução: registros "filhos" vinculados a um evento principal.

- Banco: adicionar em `eventos` a coluna `evento_pai_id` (referência ao evento principal). O gatilho que gera `codigo_evento` passa a copiar o código do pai quando a linha for um local adicional, de modo que todos compartilhem exatamente o mesmo ID. O `codigo` interno (sequencial, único) continua distinto por linha, com sufixo de local.
- Tela de evento: nova seção "Locais adicionais" (só depois do evento salvo) onde se adiciona quantos locais quiser, cada um com local, cidade/UF, datas de evento, montagem/desmontagem com horas e produtor próprios. Excluir o evento principal remove os locais vinculados.
- Gantt: cada local aparece como uma linha própria, identada/marcada como "Local 2, Local 3…" sob o mesmo código, para a produção ver o dia a dia. Filtros e navegação continuam iguais.
- Dropdown de eventos (`EventoSheetCombobox`, usado em Compras, Despesas, Estoque, Financeiro etc.): como todos os locais têm o mesmo `codigo_evento`, ele já elimina duplicados e mostra uma única opção — sem mudança de comportamento para quem seleciona.
- Calendário público: mostra o evento com todos os locais listados.

## 2. Despesas — Reposição de Estoque com itens e total calculado

- Incluir `reposicao_estoque` na lista de tipos que exibem a grade de itens (hoje só fardamento, material de limpeza, material de escritório e imobilizado). Assim ele passa a ter o mesmo comportamento: grade de itens com associação ao estoque, gravação em `demanda_itens` e validação no A Receber (que já reconhece esse tipo).
- Valor total: quando o tipo usa grade de itens, o campo "Valor total (R$)" deixa de ser editável e passa a exibir a soma calculada dos itens (quantidade × valor unitário − desconto + frete + IPI + outros custos), atualizada em tempo real e salva nesse valor. Para os demais tipos, o campo continua editável como hoje.

## 3. Estoque › A Receber — botão "Devolver" nas despesas

A tela já tem o botão de devolução para cards de Compra; os cards de Despesa não têm.

- Adicionar no diálogo "Validar recebimento" da despesa o botão **Devolver para Despesas**, com o mesmo fluxo do de compras: confirmação com motivo obrigatório, revalidação do status atual, retorno do card para a coluna **Despesa Em Andamento** no Quadro de Despesas e registro do motivo nos comentários da despesa (`demanda_comentarios`), com atualização automática das listas.

## Detalhes técnicos

- Migração: `ALTER TABLE public.eventos ADD COLUMN evento_pai_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE` + índice; ajuste de `eventos_set_codigo_evento()` para herdar `codigo_evento` do pai; `proximo_codigo_evento` reutilizado para o `codigo` do filho.
- Arquivos: `src/routes/eventos.index.tsx`, `src/components/eventos/GanttEventos.tsx`, `src/routes/calendario-publico.tsx`, `src/lib/demandas.ts` (`TIPOS_COM_ITENS`), `src/components/DemandaDialog.tsx`, `src/routes/estoque.a-receber.tsx`.
