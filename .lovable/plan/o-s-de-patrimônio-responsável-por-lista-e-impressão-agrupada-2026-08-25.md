# O.S. de Patrimônio: responsável por lista e impressão agrupada

## 1. Responsável pela liberação vira lista suspensa
Nos formulários de O.S. (nova O.S., edição e registro de devolução), o campo de texto livre "Responsável pela liberação" passa a ser um seletor com busca, alimentado pelos colaboradores ativos cadastrados em RH.

- Lista ordenada por nome, somente colaboradores ativos.
- Continua permitindo digitar um nome livre (opção "usar mesmo assim"), para não travar casos de responsável que não esteja no cadastro de RH.
- O que já está salvo em O.S. antigas permanece visível mesmo que a pessoa não esteja mais na lista.

## 2. Impressão com quantidade real agrupada
No PDF da O.S., materiais iguais deixam de aparecer em várias linhas repetidas: são agrupados por nome + especificação e mostram a quantidade somada (ex.: "Spot" com 8, em vez de 8 linhas de "Spot").

- Somam-se Saiu, Devolvido, Perdido e Pendente do grupo.
- A coluna "Identificação" mostra o código quando o grupo tem um único item; com vários códigos, exibe "vários (8)".
- A ordem segue o padrão já usado no patrimônio (especificação → nome → medida).
- O histórico de devoluções também agrupa por material dentro de cada devolução.
- A tela do sistema continua mostrando os lançamentos individuais; a mudança é só no relatório impresso.

## Detalhes técnicos
- `src/components/patrimonio/OrdensServico.tsx`: nova query dos colaboradores ativos (`rh_colaboradores`, `ativo = true`) e troca dos três `Input` de responsável por `ComboboxCreatable`/`SearchableSelect` já existente no projeto.
- `src/lib/patrimonio/os-pdf.ts`: função de agregação das linhas por chave normalizada `nome|especificacao` antes de montar as tabelas de Materiais e de devoluções, reutilizando `compareFamiliaNomeMedida` de `src/lib/patrimonio/ordenacao.ts`.
- Sem alteração de banco de dados.
