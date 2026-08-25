# Patrimônio — Aba O.S. (Ordem de Saída)

Nova aba no módulo Patrimônio para controlar material que sai do galpão e retorna, com histórico completo por O.S. As abas Saídas e Devoluções atuais continuam funcionando como estão.

## 1. Aba O.S. — lista

Menu lateral do Patrimônio ganha "O.S.". A tela lista as ordens com: número da O.S., data de saída, tipo (Empréstimo / Uso em Evento), destino (nome do evento ou da empresa/pessoa), previsão de retorno e situação:

- **Aberta** — nada devolvido
- **Parcial** — parte devolvida
- **Concluída** — tudo devolvido ou justificado

Busca por número, evento, empresa e responsável, mais filtros por tipo e situação.

## 2. Nova O.S. (saída)

Cabeçalho:
- Data de saída e previsão de retorno
- Tipo: **Uso em Evento** ou **Empréstimo**
  - Uso em Evento: campo Evento/Projeto (mesma busca de eventos já usada no módulo)
  - Empréstimo: bloco do tomador — Pessoa Jurídica (razão social, CNPJ, endereço) ou Pessoa Física (nome, CPF, endereço), sempre com **nome e CPF de quem está retirando**
- Responsável interno pela liberação e observações

**Cadastro de tomadores reaproveitável:** ao digitar o nome da empresa/pessoa, o sistema sugere tomadores já registrados e preenche CNPJ/CPF e endereço automaticamente. Todos os campos continuam editáveis; ao salvar, o cadastro é atualizado (ou criado, se for novo).

Materiais:
- Seleção **agrupada por nome + especificação** (mesmo agrupamento já usado no módulo), mostrando a quantidade disponível do grupo
- A pessoa informa quanto está saindo; o sistema valida contra o disponível
- Cada linha registra o que saiu, e a saída baixa a disponibilidade do acervo como já acontece hoje

## 3. Devolução (seção dentro da O.S.)

Na própria aba O.S., abrindo uma ordem existe a seção **Devolução**, listando cada material com: quantidade que saiu, já devolvida e saldo pendente.

A pessoa informa a quantidade devolvida. Se for menor que o pendente, aparece a pergunta obrigatória para a diferença:

- **Ainda emprestado** — a diferença fica pendente na O.S. e exige o preenchimento/atualização dos dados da O.S. (tomador completo e nova previsão de retorno) antes de salvar
- **Perda** — exige justificativa; a quantidade perdida é **baixada definitivamente do acervo**, com o motivo e o autor registrados

Cada devolução gera um registro no histórico da O.S. (data, quantidades, quem lançou, justificativas), visível na própria ordem.

## 4. Histórico

Dentro da O.S.: linha do tempo com a saída, cada devolução parcial, perdas e alterações de previsão. As movimentações continuam aparecendo também no histórico do item de patrimônio.

## Detalhes técnicos

- Tabelas novas: `pat_os` (numero sequencial, tipo, evento_projeto, tomador_id, retirante_nome, retirante_cpf, data_saida, previsao_retorno, responsavel, observacoes, status), `pat_os_itens` (os_id, item_id, quantidade_saida, quantidade_devolvida, quantidade_perdida), `pat_os_devolucoes` + `pat_os_devolucao_itens` (quantidade, motivo `emprestimo|perda`, justificativa, created_by) e `pat_tomadores` (tipo PF/PJ, nome/razão social, documento, endereço, contato). GRANTs para `authenticated`/`service_role`, RLS exigindo módulo `patrimonio` (leitura/escrita) e exclusão só para admin do módulo, seguindo o padrão das demais tabelas `pat_*`.
- Sequência do número da O.S. via função no banco, no mesmo modelo de `next_pat_requisicao_numero()`.
- Baixa de acervo: saída e perda gravam registros em `pat_movimentacoes` (`saida` / ajuste de perda) vinculados à O.S., reaproveitando os gatilhos de saldo existentes; devolução gera movimento de `entrada` como em `patrimonio/Devolucoes.tsx`.
- Front: `src/routes/patrimonio.os.tsx` + componentes em `src/components/patrimonio/OS/` reutilizando `PatGroupSelect`, `EventoSheetCombobox` e `PageHeader`; item novo no `AppSidebar` sob o grupo Patrimônio.
- Realtime: incluir as novas tabelas no hook de sincronização já existente.
