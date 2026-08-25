# Painel, documentos de colaboradores e O.S. imprimível

Três frentes: documentos + aniversário no RH, uma nova aba "Painel" (só para administradores mestres) e impressão/edição/exclusão de cada O.S. do Patrimônio.

## 1. Colaboradores — documentos e data de nascimento

- Novo campo **Data de nascimento** no cadastro do colaborador (formulário e listagem, com coluna opcional de idade).
- Nova seção **Documentos** dentro do cadastro de cada pessoa:
  - upload de arquivos (PDF, imagem, etc.) com **tipo** (RG, CPF, CTPS, ASO, Contrato, Certificado, Outros), **descrição** e **validade** opcional;
  - lista com data de envio, quem enviou, visualizar/baixar e excluir;
  - aviso visual quando a validade estiver vencida ou a vencer em 30 dias.
- Filtro na aba Colaboradores para ver **aniversariantes do mês**.

## 2. Nova aba "Painel"

Item novo no menu lateral, no grupo "Visão geral" (junto de Início e Meus Pedidos), visível **somente para administradores mestres** (mesmo controle usado no Assistente).

Blocos do Painel:

- **Aniversariantes do mês** — lista com dia, nome, departamento e destaque para o dia de hoje.
- **Indicadores financeiros** — receita, despesas, custos e lucro do mês corrente, com comparação com o mês anterior, usando o mesmo cálculo do DRE já existente (regime de caixa).
- **Comportamento do Uber** — total gasto no mês, número de corridas, ticket médio, evolução dos últimos 6 meses e ranking de colaboradores/projetos.
- **Atividades do dia** — lembretes do usuário com vencimento hoje, rotinas financeiras do dia e eventos do dia.
- **Calendário** — visão mensal onde cada dia mostra marcadores por tipo; ao clicar em um dia, abre um painel lateral com lembretes, rotinas e eventos daquela data.

## 3. O.S. do Patrimônio — imprimir, editar e excluir

Na listagem e dentro de cada O.S.:

- **Imprimir** — relatório em PDF A4 com logo da Luminart e o mesmo padrão visual dos demais relatórios: cabeçalho (nº da O.S., data de saída, previsão de retorno, tipo, situação), dados do destino (evento/projeto ou tomador completo com CNPJ/CPF, endereço e quem retirou), responsável e observações, tabela de materiais (código, nome + especificação, quantidade saída, devolvida, perdida, saldo), histórico de devoluções e linhas de assinatura (retirada e conferência).
- **Editar** — alterar cabeçalho da O.S. (datas, tipo, evento/tomador, responsável, observações) e, enquanto nada tiver sido devolvido, também ajustar quantidades e itens; itens já com devolução ficam bloqueados.
- **Excluir** — exclusão da O.S. com confirmação, devolvendo ao acervo tudo que ainda estava em aberto; restrito a administradores do módulo Patrimônio.

## Detalhes técnicos

**Banco**
- `rh_colaboradores`: nova coluna `data_nascimento date`.
- Nova tabela `rh_colaborador_documentos` (colaborador_id, tipo, descricao, arquivo_path, arquivo_nome, validade, created_by, created_at) com GRANTs para `authenticated`/`service_role`, RLS exigindo módulo `rh` (leitura/escrita) e exclusão para admin do módulo.
- Novo bucket privado `rh-documentos` com políticas em `storage.objects` no mesmo padrão de `demanda-anexos`, com sanitização de nome de arquivo.
- Nova RPC `pat_os_excluir(p_os_id)` (security definer) que estorna as movimentações em aberto e remove a O.S. e seus filhos; e `pat_os_editar(p_os_id, p_meta, p_linhas)` para ajustar cabeçalho/itens de forma atômica, validando quantidades já devolvidas.

**Frontend**
- `src/routes/rh.colaboradores.tsx` + novo `src/components/rh/DocumentosColaborador.tsx`.
- Novo `src/routes/painel.tsx` com componentes em `src/components/painel/` (Aniversariantes, IndicadoresFinanceiros, UberResumo, AtividadesDoDia, CalendarioPainel); reutiliza `src/lib/conta-azul/dre.ts`, `src/lib/uber/analises.ts` e as consultas de `lembretes`/`financeiro_rotinas`/`eventos`. Gate por `isMasterAdmin` do `AuthContext`, tanto na rota quanto no `AppSidebar`.
- Novo `src/lib/patrimonio/os-pdf.ts` com jsPDF + jspdf-autotable e a logo `@/assets/luminart-logo.png`, seguindo `src/lib/patrimonio/relatorio-pdf.ts`.
- `src/components/patrimonio/OrdensServico.tsx`: botões Imprimir/Editar/Excluir na linha da lista e no `DetalheOSDialog`, mais um `EditarOSDialog` reaproveitando o formulário do `NovaOSDialog`.
