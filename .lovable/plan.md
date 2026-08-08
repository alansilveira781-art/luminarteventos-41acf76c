# Patrimônio — A Receber: quantidade = nº de lançamentos + códigos em massa

Alinhar a validação de recebimento (aba "A receber") ao comportamento já criado no cadastro de patrimônio.

## O que muda

1. **Quantidade vira número de lançamentos**
   - Se o item vier da despesa com quantidade 20, ao finalizar são criados **20 itens de patrimônio**, cada um com quantidade 1 e ID sequencial próprio (IMO-0042, IMO-0043, …).
   - O valor unitário efetivo (já calculado com rateio de frete/desconto/IPI) é replicado em cada item.
   - Cada item gera sua própria movimentação de entrada e seu registro de vínculo com a despesa.
   - Aviso no campo: "serão criados N lançamentos (1 unidade cada)".

2. **Códigos em massa**
   - O campo "Código" passa a aceitar uma lista: valores separados por vírgula/espaço e intervalos, ex.: `101-105, 120, 131-133`.
   - Os códigos são distribuídos em ordem, um por lançamento.
   - Se forem informados menos códigos que lançamentos, os restantes ficam sem código; se forem mais, a quantidade de lançamentos se ajusta ao número de códigos informados.
   - Validação antes de gravar: códigos duplicados dentro da lista e códigos já existentes no patrimônio bloqueiam a operação com mensagem clara.

## Detalhes técnicos

- Arquivo: `src/routes/patrimonio.a-receber.tsx`.
- Reaproveitar o parser `parseCods` de `src/routes/patrimonio.index.tsx` movendo-o para um módulo compartilhado (`src/lib/patrimonio/cods.ts`) e importando nos dois lugares.
- `LinhaPat` ganha `codsText: string`; o campo numérico de Código é trocado por `Input` de texto com hint dos códigos reconhecidos.
- Na mutation `finalizar`: para cada linha, expandir em `max(quantidade, cods.length)` inserts com `quantidade: 1`, `cod` do índice correspondente, `id_item` do contador sequencial já existente.
- Checagem de duplicidade via consulta única `pat_itens.select('cod').in('cod', todosOsCods)` antes do loop de inserts.
