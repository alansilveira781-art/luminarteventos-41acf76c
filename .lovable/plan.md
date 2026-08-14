# Calendário em Lembretes + anexos do patrimônio para a Luciene

## 1. Aba Calendário nos Lembretes

Nova aba **Calendário** em `/lembretes`, entre "Semana" e "Todas", com visão **Mês + Dia**:

- Grade mensal (segunda a domingo) com navegação mês anterior/próximo e botão "Hoje".
- Cada dia mostra até 3 tarefas (ponto na cor do projeto + horário + título) e "+N mais" quando houver mais.
- Dia atual destacado; dias fora do mês em tom apagado; dias com tarefas vencidas e pendentes ganham marca vermelha.
- Clicar num dia o seleciona e abre o **painel lateral do dia** (à direita no desktop, abaixo no mobile) com:
  - data por extenso,
  - lista das tarefas daquele dia ordenadas por horário, com checkbox para concluir e clique para editar,
  - botão "+ Nova tarefa" que já abre o modal com a data preenchida.
- Tarefas de dia inteiro aparecem no topo do dia, sem horário.
- Reaproveita as mesmas consultas, o mesmo modal de tarefa e as mesmas ações de concluir/editar/excluir já existentes na tela — nada muda no banco.

## 2. Anexos das despesas na aba "A Receber" do Patrimônio

Causa confirmada: os arquivos até podem ser baixados (a regra do armazenamento já libera o módulo Patrimônio para despesas do tipo imobilizado), mas a **lista de anexos** da despesa não é liberada para quem só tem Estoque e Patrimônio — que é o caso da Luciene. Por isso a contagem aparece zerada e nenhum anexo é listado.

Correção: acrescentar uma permissão de leitura na lista de anexos das despesas para usuários com acesso ao módulo Patrimônio, restrita às despesas do tipo imobilizado — exatamente o mesmo critério que já vale para o download do arquivo. Nada é aberto além disso: quem não tem o módulo continua sem ver.

## Detalhes técnicos

- `src/routes/lembretes.tsx`: nova `TabsTrigger`/`TabsContent` "calendario" + componente `CalendarioView` (grade construída com `date-fns`, sem dependência nova).
- Estados locais: `mesRef` (mês visível) e `diaSel` (dia selecionado, padrão hoje).
- Migração SQL: `CREATE POLICY` de SELECT em `public.demanda_anexos` com `has_module_access(auth.uid(), 'patrimonio') AND EXISTS (demanda ... tipo_demanda = 'imobilizado')`.
