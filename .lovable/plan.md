# Corrigir cálculo de comissão e BV no cadastro de Vendas

## O problema (confirmado)

No formulário de venda, os campos **Valor BV** e **Valor Comissão** ficam em R$ 0,00 mesmo com consultor e cerimonial corretamente cadastrados (ex.: Pádua Costa 3%, CELEBRE 5%).

Causa: o seletor de cadastros (Consultor, Cerimonial, Decorador, Classificação) e o cálculo do formulário usam **a mesma chave de cache** (`comercial-vendedores`, `comercial-cerimoniais`), mas leem colunas diferentes:

- o seletor lê apenas `id, nome`;
- o cálculo precisa de `percentual_comissao`, `tipo_comissao` e `percentual_bv`.

Como o seletor normalmente carrega primeiro, ele sobrescreve o cache com registros sem os percentuais. O cálculo então encontra o consultor, mas com percentual ausente, e devolve zero. Isso explica também por que algumas vendas gravadas ficaram com comissão/BV zerados enquanto outras (salvas quando o cache tinha os dados completos) ficaram corretas.

## O que será feito

1. Separar os caches: o seletor de cadastros passa a usar uma chave própria (ex.: `comercial-cadastro-opcoes:<tabela>`), sem colidir com a lista completa usada nos cálculos.
2. Manter a invalidação cruzada: ao criar um novo consultor/cerimonial pelo próprio seletor, invalidar tanto a lista de opções quanto a lista completa, para o percentual recém-informado entrar no cálculo na hora.
3. Garantir que o formulário de venda só habilite o botão de salvar depois que as listas de cadastro estiverem carregadas, evitando gravar zeros por corrida de carregamento.
4. Respeitar o tipo de comissão: consultores com comissão "por gatilho" continuam com comissão zerada na venda (isso é intencional), e o formulário exibirá essa indicação em vez de parecer erro.
5. Após a correção, usar o botão já existente **Recalcular comissões/BV** na aba Vendas para corrigir os lançamentos antigos que ficaram zerados.

## Detalhes técnicos

- `src/components/comercial/CadastroCombobox.tsx`: trocar `queryKey: [queryKey]` por uma chave dedicada às opções; em `onSuccess` da criação, invalidar a chave de opções e a chave completa.
- `src/lib/comercial/cadastros.ts`: sem mudança de contrato; segue como fonte única das listas completas com percentuais.
- `src/routes/comercial.vendas.tsx`: usar os estados de carregamento de `useVendedores`/`useCerimoniais` para bloquear o submit e mostrar o aviso de comissão por gatilho.
