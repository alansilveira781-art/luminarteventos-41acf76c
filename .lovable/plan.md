## Objetivo

Criar aba **Relatórios** no módulo Contábil com a seção **Distribuição de Impostos**, que rateia os impostos apurados (de uma apuração já salva) proporcionalmente aos valores recebidos por evento no mesmo período.

## Como vai funcionar

1. Usuário abre **Contábil › Relatórios**.
2. Seleciona uma **Apuração** salva (empresa + mês/ano) → carrega os impostos apurados dela.
3. Seleciona qual **Imposto** quer visualizar (COFINS, PIS, ISS, IRPJ, CSLL…) ou "Todos".
4. Sistema lista os **recebimentos** do mesmo período/empresa agrupados por evento, e para cada evento mostra:
   - Valor recebido
   - % do total recebido
   - Valor do imposto rateado proporcionalmente
5. Totalizadores no rodapé (soma dos recebimentos, soma do imposto rateado — deve bater com o apurado).
6. Botão **Exportar** (PDF/Excel), mesmo padrão de Apurações.

## Fórmula do rateio

Para cada evento:
```
imposto_evento = imposto_total_apurado × (valor_recebido_evento / soma_valores_recebidos_periodo)
```
Ajuste de resíduo de centavos aplicado na maior fatia para garantir soma exata.

## Arquivos a criar/alterar

- **Criar** `src/routes/contabil.relatorios.tsx` — nova rota com a seção Distribuição de Impostos (estrutura pensada para receber outros relatórios futuros).
- **Editar** `src/components/AppSidebar.tsx` — adicionar item "Relatórios" no grupo Contábil.

## Detalhes técnicos

- Fonte dos impostos apurados: recalcular via `calcularImpostosPresumido` (mesma função da tela de Apurações) usando `contabil_configuracao_aliquotas` + faturamento do período — mantém consistência com a apuração exibida.
- Fonte dos recebimentos: `contabil_recebimentos` filtrando por `empresa` e `data_recebimento` dentro do mês da apuração; agrupamento por `nome_evento` (recebimentos sem evento entram como "Sem evento vinculado").
- Seletor de apuração usa os mesmos filtros de empresa/mês/ano já usados em Apurações.
- Exportação PDF via `jspdf`/`jspdf-autotable` (import dinâmico, mesmo padrão de `financeiro-op.relatorios.tsx`) e Excel via `xlsx` (import dinâmico).

Nenhuma mudança de schema é necessária.