## Contexto

Em `AnaliseDetalhada` (`src/components/financeiro/ContaAzulDashboard.tsx`) já existe uma leitura das `movimentacoes` tipo `saida` cruzando por `evento_projeto` com o nome do centro de custo selecionado, e as somas já são adicionadas ao DRE. **Mas** hoje cada linha de estoque aparece como uma linha separada rotulada "(estoque)" — chave `stock:<categoria>` — porque o código não faz o casamento da categoria do item com o plano de contas do Conta Azul.

O usuário quer:
- **Sem mudança visual.** Somar dentro das linhas existentes de Custos Variáveis / Custos Diretos, na mesma categoria do plano de contas — sem criar linha nova "(estoque)".
- Casar `itens.categoria` **por nome** com `ca_plano_contas.nome` (o usuário garante que os nomes batem). O grupo do DRE (CV/CD/etc.) sai naturalmente do prefixo do plano.
- Continuar cruzando `movimentacoes.evento_projeto` com o nome do `centro_custo` selecionado (já é assim).

## Mudança

Ajustar somente o bloco `stockAgg` em `src/components/financeiro/ContaAzulDashboard.tsx` (~linhas 720-746):

1. Construir um índice `nomePlano (normalizado) → { external_id, grupo }` a partir de `planosArr` + `grupoDoPlanoNome(plano.nome)`.
2. Para cada saída elegível (evento casa com o centro), procurar o plano pelo nome da categoria do item (case/acento-insensível).
3. Se casar: usar `categoria_external_id` como chave de detalhe (mesma chave usada pelos rateios do Conta Azul) → **soma direta na linha existente** do plano de contas, dentro do grupo correto (CV/CD/…).
4. Se não casar: manter fallback atual (agrupa em "SC – Sem classificação") para não perder valor — sem criar novo comportamento visual.
5. Remover a lógica atual de chave `stock:<cat>` e do rótulo "(estoque)" — não é mais necessária pois os valores mesclam nas linhas do próprio plano de contas.
6. `estruturaEfetiva`/`planoMapExt` seguem funcionando: `planoMapExt` só precisa continuar cobrindo o caso "SC" quando houver fallback.

## Escopo

- Só `src/components/financeiro/ContaAzulDashboard.tsx`, dentro do componente `AnaliseDetalhada`.
- Nada de mudança em UI, cores, layout, colunas, títulos.
- Nada de migração, backend, `sync.server.ts`, nem outras telas (dashboard principal, DRE do módulo Financeiro etc.).
- Nada de novos filtros/toggles.

## Fora do escopo (confirmar se quiser incluir)

- Mostrar as saídas de estoque também no painel principal (Dashboard Conta Azul) ou no DRE de `/financeiro/dashboard`. Aqui a instrução foi só "Análise Detalhamento" — mantenho só lá.

## Validação

Selecionar um centro de custo que tenha saídas de estoque no evento correspondente e conferir que o valor entra na linha da categoria correta em CV/CD, sem aparecer nenhuma linha nova rotulada "(estoque)".