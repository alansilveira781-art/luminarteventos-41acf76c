# Comissões que não aplicaram + Bonificação no Financeiro

## 1. Por que algumas vendas ficaram sem comissão

Verifiquei os dados. A comissão só é calculada no momento em que a venda é salva pelo formulário: o sistema procura o consultor no cadastro pelo nome **exatamente igual** e aplica o % dele. Fora desse caminho, nada recalcula. Daí vêm três causas reais encontradas:

- **Consultor não existe no cadastro**: "André" (103 vendas), "Maicon" (72), "MAICON" (3), "Gabi" (1) e "-" (11) não têm ficha em Configurações, então o % é zero.
- **Nome escrito diferente do cadastro**: "MAICON" vs "Maicon", "Padua" vs "Pádua Costa" — a comparação hoje é sensível a maiúsculas e acentos.
- **Vendas antigas/importadas ou editadas em massa**: 8 vendas do "Romulo Manoel" (que tem 2% cadastrado) estão com comissão zerada, incluindo MÉTODO CIS 251 e STAND SCIENTIFIC DENTAL. A edição em massa troca o consultor mas não recalcula comissão nem BV.

### O que muda

- Comparação de nomes passa a ignorar maiúsculas, acentos e espaços extras (consultor, cerimonial).
- A edição em massa passa a recalcular comissão e BV sempre que consultor, cerimonial, valor da proposta ou desconto forem alterados.
- Botão **"Recalcular comissões/BV"** na aba Vendas: reaplica os percentuais do cadastro nas vendas do filtro atual (ou nas selecionadas), mostrando antes um resumo de quantas mudam e quantas ficam de fora por consultor sem cadastro.
- Aviso visual na listagem/formulário quando o consultor informado não existe no cadastro (por isso não gera comissão).

## 2. Bonificação vira aba do Financeiro

- Nova página **Financeiro > Bonificação**, com a distribuição, o fechamento do mês e o histórico de períodos que existem hoje.
- Nova página **Financeiro > Bonificação — Configurações**, recebendo o esquema atual: produtores e alçadas de complexidade por categoria (multiplicadores), hoje em Comercial > Configurações.
- A seção **Distribuição Bonificação sai do Comercial > Relatórios** e a parte de produtores/alçadas sai de Comercial > Configurações.
- Acesso: módulo `financeiro_op` (admins do módulo podem fechar o mês, como hoje no comercial).

## 3. Listagem por eventos realizados do calendário

- A lista deixa de vir das vendas e passa a vir dos **eventos do calendário já realizados** no mês/ano filtrado — ou seja, com data final do evento menor ou igual a hoje.
- Cada linha mostra o evento (nome, período, local) e permite atribuir um ou mais produtores com a complexidade, como hoje.
- Quando o evento estiver vinculado a uma venda, a categoria/valor da venda é usada para sugerir a complexidade automaticamente; sem vínculo, a sugestão fica em branco para preenchimento manual.
- Fechamentos já existentes continuam visíveis no histórico, sem alteração.

## Detalhes técnicos

- `comercial_vendas`: nenhuma mudança de schema. Recalculo em `src/routes/comercial.vendas.tsx` (função `derived` + `bulkMut`) usando um helper novo `src/lib/comercial/comissao.ts` com `matchCadastro(nome, lista)` normalizando via `normalize()` de `@/lib/utils`, e `calcularDerivados()` reaproveitado pelo formulário, pela edição em massa e pelo recálculo em lote (update em chunks por id).
- Migração: adicionar `evento_id uuid` (nullable, FK `eventos`) em `comercial_bonificacao_producao` e `comercial_bonificacao_fechamento_itens`, com índice único parcial `(evento_id, produtor_id)`; `venda_id` continua nullable para os registros antigos.
- Mover `DistribuicaoBonificacao` de `src/routes/comercial.relatorios.tsx` para `src/components/financeiro/DistribuicaoBonificacao.tsx`; novas rotas `src/routes/financeiro-op.bonificacao.tsx` e `src/routes/financeiro-op.bonificacao.configuracoes.tsx`; itens no `AppSidebar` no grupo Financeiro.
- Fonte da lista: `eventos` filtrando `evento_pai_id is null`, `coalesce(data_evento_fim, data_evento) <= today` e dentro do mês/ano; join opcional em `comercial_vendas` por `venda_id` para categoria e valor final.
- `src/lib/comercial/bonificacao.ts` passa a chavear por `evento_id` (hooks `useBonificacoes`, `useBonificacaoMutations`, `useFecharMes`), mantendo leitura dos registros legados por `venda_id`.
