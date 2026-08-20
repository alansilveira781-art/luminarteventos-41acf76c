# Proposta obrigatória antes da Validação (Jurídico)

## Objetivo
O card só pode avançar para a coluna **Validação** se tiver a proposta anexada. Na etapa de **Criação** o usuário deve poder anexar essa proposta.

## Comportamento

1. **Etapa Criação** — no diálogo que aparece ao mover o card para Criação (definição de categoria), incluir um campo de upload "Proposta (PDF/imagem)". O arquivo é salvo no anexo do contrato com tipo `proposta`. Se já existir uma proposta anexada, mostrar o nome do arquivo e permitir substituir.

2. **Bloqueio ao mover para Validação** — ao arrastar (ou avançar) um card para Validação, o sistema verifica se existe anexo com tipo `proposta` naquele contrato. Se não existir:
   - o card volta para a coluna de origem,
   - aparece um aviso: "Anexe a proposta antes de enviar para Validação",
   - opcionalmente abre o card na aba Anexos para o usuário anexar na hora.

3. **Indicador visual** — no card do Kanban, um pequeno selo "Proposta" quando o anexo existe, para o usuário ver de relance quais cards estão prontos.

4. Cards que já estão em Validação ou adiante não são afetados retroativamente; a regra vale apenas na transição.

## Detalhes técnicos
- Fonte da verdade: `juridico_anexos` com `tipo = 'proposta'` e `contrato_id` do card.
- Carregar, junto do `load()` do quadro em `src/routes/juridico.index.tsx`, um conjunto de `contrato_id` que possuem anexo de proposta, para o selo e a validação sem consulta extra por drag.
- No `onDragEnd`, antes do update de status para `validacao`, checar esse conjunto (com re-checagem no banco para evitar dado velho) e abortar com toast se ausente.
- Upload na Criação reutiliza o padrão já existente (bucket `juridico-anexos`, path `${contratoId}/${Date.now()}_${nomeSanitizado}`, insert em `juridico_anexos` com `tipo: "proposta"`).
- Sem alteração de schema nem de RLS.
