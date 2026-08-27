# Corrigir “Somente dias úteis” nos Lembretes

## Diagnóstico confirmado

A série **Contrato Suênia** possui três ocorrências (27, 28 e 29/08/2026), incluindo sábado. A opção “Somente dias úteis” existe apenas no estado temporário do formulário: ela não é persistida na tarefa, volta desligada ao reabrir e não participa da detecção de mudança da recorrência. Por isso, marcar apenas essa opção não reprograma as datas.

## Correção

- Adicionar às tarefas o campo persistente `somente_dias_uteis`, com padrão `false`, mantendo compatibilidade com os lembretes existentes.
- Carregar o valor salvo ao editar uma tarefa e mantê-lo marcado corretamente no formulário.
- Incluir essa opção na comparação das regras de recorrência, para que ativá-la ou desativá-la regenere as ocorrências no escopo escolhido (“futuras” ou “toda a série”).
- Persistir a configuração em todas as ocorrências geradas e exibi-la no resumo da recorrência.
- Corrigir a série **Contrato Suênia**, removendo a ocorrência de sábado e mantendo a sequência diária apenas em dias úteis.

## Validação

- Editar uma série diária, marcar “Somente dias úteis” e aplicar às ocorrências futuras.
- Reabrir a tarefa e confirmar que a chave continua ligada.
- Confirmar que sábado e domingo não aparecem e que a quantidade configurada de ocorrências é preservada.
- Verificar especificamente a série “Contrato Suênia” após a correção.
