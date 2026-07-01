## Onde está o botão

Você está na aba **Devoluções do módulo Estoque** (`/devolucoes`), arquivo `src/routes/devolucoes.tsx`. O botão "Imprimir formulário" que criamos anteriormente foi adicionado apenas na tela análoga de **Patrimônio** (`src/components/patrimonio/Devolucoes.tsx`) — por isso ele não aparece aqui. É uma tela diferente, com outro formulário (Responsável pela devolução / pelo recebimento / coluna "Sem devolução").

## Plano

Adicionar o mesmo botão "Imprimir formulário" no diálogo **Nova devolução** do Estoque:

1. Em `src/routes/devolucoes.tsx`:
   - Importar `Printer` de `lucide-react`.
   - No rodapé do form (`FormActions`, linha 595), colocar dois botões: à esquerda `Imprimir formulário` (variant outline, desabilitado enquanto não houver saída selecionada); à direita o atual `Registrar devolução`.
   - Criar a função `imprimirFormularioDevolucao` local, usando **iframe oculto** (mesma estratégia à prova de bloqueio de pop-up que aplicamos no Patrimônio).

2. Conteúdo do formulário impresso, alinhado ao form desta tela:
   - Cabeçalho: título, data/hora de impressão.
   - Dados da saída selecionada: código da requisição (REQ-XXXX), data da saída, solicitante/evento (o que estiver disponível no grupo).
   - Dados da devolução (do form): Data, Responsável pela devolução, Responsável pelo recebimento, Observações.
   - Tabela de itens da saída com as colunas: **Item · Saída · Já devolvido · Saldo · Devolver agora (sistema) · Físico (em branco p/ preencher) · Sem devolução (□) · Condição/Obs. (em branco)**.
   - Linhas de assinatura: "Entregue por" e "Recebido por".

3. Sem mudanças em lógica, banco ou permissões — apenas UI + função de impressão.

## Arquivos afetados

- `src/routes/devolucoes.tsx` — botão no rodapé do `DevolucaoForm` e nova função `imprimirFormularioDevolucao`.
