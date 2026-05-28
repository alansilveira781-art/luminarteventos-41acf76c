## Objetivo

Remover a página "Eventos / Projetos" do módulo Financeiro e fazer com que toda a lista de eventos venha **diretamente da planilha do Google Sheets** (a mesma que já é lida em Estoque > Saídas via `listEventos`), em vez de uma tabela editável no banco.

A planilha tem estas colunas:
`ID | Nome do evento | Início | Final | Local | UF | Produtor | Início Montagem | Final Montagem | Início Desmontagem | Final Desmontagem | Observações | (ids de calendar)`

A coluna **ID** (ex: `46115 - FEIRA RT 360º - CENTRO DE EVENTOS DO CEARÁ`) é o identificador legível que será usado em todo o sistema.

## Mudanças

### 1. Remover a página Eventos/Projetos do Financeiro
- Apagar `src/routes/financeiro.eventos.tsx`.
- Remover o item "Eventos / Projetos" do `src/components/AppSidebar.tsx`.
- Manter a tabela `eventos_projetos` no banco intacta (não vamos mais escrever nela, mas dados antigos ficam preservados) — sem migration de drop.

### 2. Expandir `listEventos` (server function)
Em `src/server/sheets.functions.ts`:
- Continuar lendo a primeira aba da mesma planilha.
- Retornar um array de objetos com todos os campos relevantes (id, nome, dataInicio, dataFim, local, uf, produtor, montagem, desmontagem, observacoes).
- Manter cache leve no cliente via React Query (`staleTime` ~5 min) como já é feito em Saídas.

### 3. Novo componente `EventoSheetCombobox`
Criar `src/components/EventoSheetCombobox.tsx`:
- Mesmo visual e UX do `DbComboboxCreatable` (digitar para filtrar, texto selecionável, fecha ao escolher).
- **Read-only** (sem botão "+", sem excluir) — fonte da verdade é a planilha.
- Filtro tolerante a acento, casando contra `id`, `nome`, `local`, `produtor`.
- Mostra "ID" como label principal e uma segunda linha com `local · período` para facilitar identificar o evento certo.
- Botão discreto "Atualizar" que invalida a query (útil quando alguém acabou de adicionar na planilha).
- Valor armazenado: a string do ID do evento (mesmo padrão atual que grava texto em `evento_projeto`).

### 4. Trocar `DbComboboxCreatable(table="eventos_projetos")` por `EventoSheetCombobox`
Substituir em:
- `src/components/DemandaDialog.tsx` (Financeiro > Quadro de Demandas, aba Descritivo)
- `src/components/patrimonio/Movimentacoes.tsx` (Patrimônio > Saídas e Entradas)

Os demais usos de `DbComboboxCreatable` (ex: Finalidade) continuam usando o banco — não mudam.

### 5. Tratamento de erro
Se o conector do Google Sheets não responder (sem chave / 401), o combobox mostra mensagem clara no popover ("Não foi possível carregar eventos da planilha") com um botão "Tentar novamente", sem quebrar o formulário.

## Pontos técnicos

- Não vamos sincronizar a planilha para o Supabase — leitura é direta a cada carregamento (com cache do React Query).
- A coluna `evento_projeto` nas tabelas `movimentacoes` e `demandas` continua sendo texto livre; só muda a origem das sugestões.
- Sem migrations nesta etapa.

## Arquivos afetados

- delete: `src/routes/financeiro.eventos.tsx`
- create: `src/components/EventoSheetCombobox.tsx`
- edit: `src/server/sheets.functions.ts` (retorna objetos ricos)
- edit: `src/components/AppSidebar.tsx` (remove o item)
- edit: `src/components/DemandaDialog.tsx`
- edit: `src/components/patrimonio/Movimentacoes.tsx`
