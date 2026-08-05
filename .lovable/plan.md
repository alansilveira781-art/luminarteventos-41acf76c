# Produtor do evento: interno ou terceirizado (PJ)

## O que muda no formulário de Eventos

Antes do campo "Produtor do evento" entra uma opção **"Produção terceirizada?"**.

- **Desmarcado (produtor da empresa)**: o campo vira uma lista suspensa alimentada pelos produtores cadastrados em Financeiro > Bonificação > Configurações. Só é possível escolher da lista — não há opção de adicionar nome novo por ali.
- **Marcado (terceirizado)**: o campo passa a ser um campo de terceirizados PJ, com busca e a opção de **cadastrar um novo terceirizado digitando o nome** ali mesmo. Os terceirizados cadastrados assim ficam salvos e reaparecem para os próximos eventos.

Ao trocar a opção, a seleção anterior é limpa para não misturar produtor interno com terceirizado.

Na listagem/Gantt/relatórios o nome do produtor continua aparecendo igual; quando for terceirizado, ganha um indicativo discreto "terceirizado".

## Detalhes técnicos

- Migração:
  - `eventos`: adicionar `produtor_terceirizado boolean not null default false` e `terceirizado_id uuid` (FK para a nova tabela, nullable). `produtor`/`produtor_id` continuam como estão.
  - Nova tabela `eventos_terceirizados` (`nome`, `documento` opcional, `ativo`, timestamps), com GRANTs para `authenticated`/`service_role`, RLS ligada e políticas: leitura para autenticados; inserir/editar para quem tem o módulo `eventos` (ou admin); exclusão só para admin do módulo.
- `src/routes/eventos.index.tsx`:
  - a lista de produtores internos passa a vir de `comercial_produtores` (mesma fonte do `useProdutores` em `src/lib/comercial/bonificacao.ts`), filtrando ativos, em vez da tabela `produtores` usada hoje.
  - novo estado `produtor_terceirizado` no form; render condicional: `select` simples (interno) ou `DbComboboxCreatable`/`ComboboxCreatable` sobre `eventos_terceirizados` (terceirizado), gravando nome em `produtor` e id em `terceirizado_id`.
  - `payload` de insert/update passa a incluir os novos campos, limpando o par não usado.
- Eventos já existentes continuam como produtor interno (`produtor_terceirizado = false`), com o nome preservado em `produtor` mesmo se não constar na nova lista.
