# Corrigir link compartilhado de cards do Quadro de Compras

## O que está acontecendo

Ao investigar o código do quadro, encontrei três causas para o link compartilhado não abrir o card:

1. **Cards de Aquisição/Demanda copiam um link antigo.** O botão "Copiar link" dentro do card de demanda gera `/financeiro?id=...`. A rota `/financeiro` foi desativada e redireciona para `/compras`, mas o redirecionamento descarta o `?id=`. Resultado: o quadro abre sem card nenhum.
2. **O link de demanda não indica a origem.** Mesmo corrigido o caminho, sem `&origem=demanda` o quadro tenta abrir o card como uma compra e o formulário vem vazio.
3. **A leitura do link só acontece uma vez.** O quadro lê o `?id=` apenas na montagem da página lendo a URL direta. Se a pessoa já estiver com o quadro aberto e clicar no link (ou fechar o card e voltar), nada acontece, porque a mudança de URL não é observada.

## O que será feito

- Corrigir o botão "Copiar link" do card de Aquisição para gerar `/compras?id=<id>&origem=demanda`.
- Fazer a rota antiga `/financeiro` preservar os parâmetros ao redirecionar para `/compras`, para que links já compartilhados continuem funcionando.
- Tornar a abertura pelo link reativa: o quadro passa a observar os parâmetros de busca da rota, abrindo o card sempre que o link mudar.
- Quando o link não trouxer a origem, identificar automaticamente se o id pertence a uma compra ou a uma aquisição e abrir o formulário correto.
- Limpar o `?id=` da URL ao fechar o card, para que reabrir o mesmo link funcione novamente.
- Se o id não existir (card excluído) ou o usuário não tiver acesso, mostrar um aviso claro em vez de um formulário em branco.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: adicionar `validateSearch` (`id`, `origem`) na rota, trocar o `useEffect` baseado em `window.location.search` por `Route.useSearch()` com efeito dependente, e usar `navigate({ search: {} , replace: true })` ao fechar os diálogos.
- Resolução de origem: quando `origem` ausente, procurar o id nas listas já carregadas de `compras` e `demandas`; se não encontrar em nenhuma, consultar as duas tabelas por `id` antes de decidir/avisar.
- `src/components/DemandaDialog.tsx`: `CopiarLinkButton path={`/compras?id=${demandaId}&origem=demanda`}`.
- `src/routes/financeiro.tsx`: no `Navigate to="/compras"`, repassar `search` da location atual.
