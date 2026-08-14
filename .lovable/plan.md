# Solicitações de saída (compensado/MDF)

Um formulário público para o Erivaldo registrar retiradas de material, e uma nova aba no módulo Estoque onde alguém do time confere, associa cada material a um item do estoque e valida — gerando a saída real (com baixa de saldo).

## 1. Formulário público `/solicitar-saida`

Página aberta (sem login), no mesmo estilo do formulário público de solicitação já existente.

Campos:
- **Data de retirada** (padrão: hoje)
- **Solicitante** — lista suspensa com os solicitantes ativos do cadastro do Estoque
- **Materiais** (uma ou mais linhas):
  - Descrição do material (texto livre)
  - Quantidade
- **É para evento?** Sim/Não
  - Sim: campo Evento/Projeto igual ao usado hoje (busca na lista de eventos)
  - Não: campo livre para digitar a finalidade/destino
- **Observações** (opcional)

Ao enviar, o registro entra como "Pendente" e aparece imediatamente na nova aba.

## 2. Nova aba "Solicitações de saída" no Estoque

Nova entrada no menu lateral do Estoque, listando as solicitações com: data de retirada, solicitante, materiais (quantidade), evento/finalidade e situação (Pendente / Validada / Recusada).

Ao clicar em uma solicitação abre o painel de validação:
- Mostra tudo que o Erivaldo preencheu (somente leitura, com opção de corrigir quantidade)
- Para cada material digitado: campo de busca para **associar a um item do estoque**, com botão para **desassociar** e escolher outro
- Campos que faltam para a saída, iguais aos do lançamento de saída atual: tipo de saída, evento/projeto, finalidade, responsável pela retirada, responsável pelo recebimento, responsável pelo lançamento, observações, previsão de devolução quando aplicável
- Botão **Validar saída**: só habilita quando todos os materiais estão associados a itens; cria a movimentação de saída real (baixando o saldo) e marca a solicitação como Validada, guardando quem validou e quando
- Botão **Recusar** com motivo

Solicitações já validadas ficam somente leitura, com link para a saída gerada.

## Detalhes técnicos

- Tabelas novas: `estoque_solicitacoes_saida` (data_retirada, solicitante_id, is_evento, evento_projeto, finalidade_livre, observacoes, status, validado_por/em, movimentacao_id) e `estoque_solicitacoes_saida_itens` (descricao, quantidade, item_id nullable). GRANTs + RLS: leitura/escrita para `authenticated`; escrita pública apenas via server function.
- Envio público por `createServerFn` sem auth (validação Zod, sem chave de serviço exposta), seguindo o padrão de `/solicitar`; leitura dos solicitantes e eventos pelo mesmo caminho público já usado por `EventoPublicCombobox`.
- Rotas novas: `src/routes/solicitar-saida.tsx` (pública) e `src/routes/estoque.solicitacoes-saida.tsx` (interna, módulo estoque), com item no `AppSidebar`.
- A validação reaproveita a mesma criação de `movimentacoes`/`movimentacao_itens` usada em `src/routes/saidas.tsx`, extraindo a parte compartilhada do formulário para um componente reutilizável.
- Realtime: incluir as novas tabelas no hook de sincronização do estoque.
