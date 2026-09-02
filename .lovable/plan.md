# Solicitações do link público que "somem" antes do quadro

## O que eu verifiquei (fatos, não suposições)

- Enviei uma solicitação de teste real pelo endereço publicado e pelo preview: o card foi criado normalmente (compra nº 484, "TESTE DIAGNOSTICO NAO USAR" — será removida).
- O envio com anexos (formato multipart) também é aceito no site publicado.
- No banco, as solicitações do link continuam chegando: 01/09 entraram 3 compras pelo formulário (nº 480, 481, 482), inclusive já movidas para "Aprovada"/"Análise" por vocês.
- Hoje (02/09) não entrou nenhuma solicitação pelo link, além da minha de teste.
- As regras de acesso estão corretas: quem tem o módulo Compras enxerga tanto compras quanto aquisições criadas pelo formulário; elas entram na coluna **Solicitação**.

Ou seja: quando o formulário devolve o número, o card existe no banco. O sumiço acontece **na exibição** ou o envio nem chegou ao servidor (mesmo mostrando tela de sucesso não dá para saber hoje, porque não há registro de tentativas).

Duas causas prováveis, ambas tratadas abaixo:

1. **Filtros salvos no quadro.** Os filtros do Kanban ficam gravados no navegador de cada pessoa. Se alguém deixou um filtro ligado (comprador, período, condição de pagamento, empresa), os cards novos ficam invisíveis para ela — e continuam invisíveis nos dias seguintes, mesmo depois de recarregar.
2. **Falta de rastro do envio.** Hoje não existe nenhum registro de tentativas do formulário. Se um envio falhar no meio do caminho, não sobra evidência, e não conseguimos distinguir "não enviou" de "enviou e não aparece".

## O que será feito

1. **Registro de todas as tentativas do link público**
   Toda submissão passa a ser gravada (quem, quando, tipo, título, resultado: criado / recusado / erro), inclusive quando falha. Com isso, na próxima reclamação eu digo em segundos se o pedido chegou e o que aconteceu.

2. **Aviso de filtros ativos no Quadro de Compras**
   Faixa visível no topo com a quantidade de filtros ligados e botão "Limpar filtros". Quando os filtros escondem todos os cards de uma coluna, a coluna mostra o aviso em vez de aparecer vazia.

3. **Confirmação mais útil na tela de sucesso**
   Além do número, mostrar o código do card (COMPRA-XXX / AQUISIÇÃO-XXX) e a orientação de que ele entra na coluna "Solicitação" do Quadro de Compras. Assim dá para localizar pela busca do quadro.

4. **Notificação de chegada**
   Quando entra uma solicitação pelo link, os responsáveis padrão da etapa "Solicitação" recebem notificação no sistema, para não depender de alguém olhar o quadro.

5. **Limpeza**
   Excluir o card de teste nº 484 criado durante o diagnóstico.

## Detalhes técnicos

- Nova tabela `public.solicitacoes_publicas_log` (tipo, título, solicitante, e-mail, ip_hash, resultado, mensagem de erro, id gerado), gravada em `src/routes/api/public/solicitar.ts` em todos os caminhos de saída (400, 429, 500 e sucesso). Leitura restrita a quem tem o módulo Compras; gravação apenas pelo servidor.
- `src/routes/compras.index.tsx`: contador de filtros ativos a partir do estado persistido `compras.kanban`, faixa com "Limpar filtros" e aviso por coluna quando `byStatus[s].length === 0` mas existem cards antes da filtragem.
- `src/routes/solicitar.tsx`: tela de conclusão exibe o código formatado além do número.
- Notificação via `enqueue_notificacoes` para os `compras_status_defaults` / `financeiro_status_defaults` da etapa `solicitacao`, disparada no próprio endpoint público.
