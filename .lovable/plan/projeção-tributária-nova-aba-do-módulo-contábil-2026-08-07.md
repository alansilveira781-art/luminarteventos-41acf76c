# Projeção Tributária — nova aba do módulo Contábil

Nova aba onde o usuário digita o valor de uma nota fiscal, escolhe a atividade e a competência, clica em Analisar e recebe, para cada empresa do grupo, quanto aquela nota custa em impostos — com memória de cálculo aberta, projeção de 12 meses, alertas e veredito de qual empresa deve emitir.

Regra do projeto: nenhum número aparece sem que o usuário consiga abrir e ver como foi calculado.

## Etapa 1 — Base de dados

Quatro tabelas novas, com as mesmas regras de acesso das demais tabelas do módulo Contábil (somente quem tem o módulo Contábil ou é administrador):

- **fiscal_empresas** — cadastro fiscal: nome, CNPJ, regime (Simples / Presumido / Real), anexo, início de atividade, ISS municipal, RAT, presunções de IRPJ e CSLL, marcador de adicional de IRPJ já ativo, CNAEs, atividades permitidas e ativo/inativo.
- **fiscal_faturamento** — receita bruta e folha bruta por empresa e por mês (um registro por competência).
- **fiscal_faixas_simples** — as 30 faixas dos Anexos I a V (limites, alíquota nominal, parcela a deduzir) e as colunas de repartição por tributo, preenchidas só no Anexo III conforme a tabela enviada. Nos demais anexos a repartição fica vazia e a tela mostra "repartição não cadastrada".
- **fiscal_projecoes** — histórico das análises rodadas, com o resultado completo guardado.

Seeds: as 30 faixas, a repartição do Anexo III e a Luminart Tecnologia (Simples, Anexo III, início 30/12/2025, atividades "Apoio administrativo" e "Tecnologia para eventos"). As demais empresas entram como Presumido, com ISS e presunções a preencher na tela.

## Etapa 2 — Motor de cálculo

Módulo isolado `src/lib/fiscal/engine.ts`, sem React e sem banco (recebe tudo por parâmetro), contendo:

- **RBT12** — soma dos 12 meses anteriores; empresa nova usa a regra proporcional (1º mês: receita × 12; 2º ao 12º: média × 12), sempre declarando qual regra foi usada e quantos meses de histórico existem.
- **Alíquota efetiva** do Simples pela faixa do RBT12.
- **Fator R** — Anexo V com fator ≥ 0,28 passa a calcular pelo Anexo III, registrando a troca.
- **Custo real da nota no Simples** — duas simulações de 12 meses (com e sem a nota), recalculando RBT12 e alíquota mês a mês. Devolve custo imediato, arrasto, custo total, alíquota marginal e os dois arrays mensais.
- **Encargos de folha** — 20% INSS + RAT + 5,8% terceiros; zerado no Simples (exceto Anexo IV); no Presumido e no Anexo IV entra como linha informativa separada, marcada como custo fixo mensal não atribuível à nota, salvo se o usuário informar folha incremental.
- **Lucro Presumido** — PIS, COFINS, IRPJ, adicional, CSLL e ISS sobre a nota, com arrasto explicitamente zero e explicado.
- **Alertas** — mudança de faixa, sublimite de 3,6 mi, limite de 4,8 mi, Fator R entre 0,25 e 0,28, Anexo IV sem CPP e adicional de IRPJ incidindo.
- **Trava de compatibilidade** — atividade fora da lista da empresa marca o resultado como bloqueado, fora do ranking, com o texto de incompatibilidade. Sem opção de desligar na interface.
- **Memória de cálculo** — todo cálculo devolve passos com título, fórmula, substituição numérica, resultado e nota opcional.

## Etapa 3 — Interface

Rota `/contabil/projecao`, com item na barra lateral do módulo Contábil, no mesmo padrão das abas existentes.

**Cabeçalho** — valor da nota (moeda pt-BR), seletor de atividade (união das atividades das empresas ativas), seletor de competência (mês atual por padrão), botão Analisar e link discreto para configurar empresas e lançar faturamento mensal. Antes de analisar, estado vazio explicando o que a aba faz.

**Resultado**
- Faixa de veredito com a empresa de menor custo e a economia sobre a segunda opção; se a diferença for menor que 2% do valor da nota, o texto vira "diferença irrelevante, decida pelo critério operacional".
- Um card por empresa, do menor para o maior custo, bloqueadas por último em cinza: cabeçalho com regime e custo, parágrafo descritivo gerado a partir dos próprios números, tabela de composição por tributo, sanfona "Como chegamos nesse valor" com a memória passo a passo, sanfona "Projeção dos 12 meses" (só Simples) comparando os dois cenários mês a mês, e alertas coloridos por severidade no rodapé.
- Gráfico de barras horizontais comparando o custo total por empresa, separando custo imediato e arrasto.
- Cada análise é gravada no histórico, com painel para reabrir análises anteriores.

**Rodapé fixo** — "Projeção baseada nos parâmetros cadastrados. Não substitui a apuração da contabilidade. Confirme o enquadramento e as alíquotas municipais antes de decidir."

## Etapa 4 — Telas de apoio

CRUD de empresas fiscais (regime, anexo, ISS, RAT, presunções, CNAEs, atividades) e lançamento de faturamento mensal por empresa (receita e folha), acessíveis pelo link "Configurar empresas".

## Validação antes de entregar

Os cinco testes de aceite serão rodados contra o motor: fronteira de faixa no Anexo III (14,02% efetiva, custo total R$ 20.633), Lucro Presumido (R$ 19.530), início de atividade (RBT12 proporcional de R$ 480.000 e 9,83%), trava de compatibilidade e alerta de sublimite. Os testes 2, 3 e a alíquota efetiva do teste 1 conferem com as fórmulas descritas. O arrasto de R$ 6.613 depende da receita média projetada; se a simulação de 12 meses devolver um número diferente, reporto a diferença com a memória de cálculo em vez de forçar o resultado.

## Notas técnicas

- Percentuais gravados como número inteiro/decimal em base 100 (16 = 16%), convertidos só no cálculo; `numeric` no Postgres e arredondamento apenas na exibição.
- Formatação monetária com `Intl.NumberFormat` pt-BR.
- Motor puro em `src/lib/fiscal/engine.ts`; a rota apenas busca dados e renderiza.
- ISS por competência fica fora do escopo desta aba, conforme indicado.
