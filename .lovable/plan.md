# Ajuste: anexos de despesas no Estoque › A Receber

## Diagnóstico
Na aba **Estoque › A Receber**, o card de despesa (originado de uma demanda) tenta baixar o arquivo do bucket `demanda-anexos`. A política RLS atual desse bucket em `storage.objects` só permite leitura para quem tem acesso ao módulo **financeiro**:

```
qual: bucket_id = 'demanda-anexos' AND has_module_access(auth.uid(), 'financeiro')
```

Como o usuário está operando pelo módulo **estoque**, o `download()` retorna erro de permissão, o `AnexoViewer` cai no `toast.error("Não foi possível abrir a prévia")` e o preview fica travado no spinner (mesmo comportamento visto no print). O botão **Baixar** falha pelo mesmo motivo.

Para comparação, o bucket `compra-anexos` já contempla os dois módulos (`compras` OR `estoque`) e por isso funciona normalmente na mesma tela.

## Correção
Migração única atualizando as 4 políticas do bucket `demanda-anexos` (SELECT/INSERT/UPDATE/DELETE) para também autorizar quem tem acesso ao módulo `estoque`, mantendo `financeiro`:

```sql
using  ( bucket_id = 'demanda-anexos'
         AND ( has_module_access(auth.uid(), 'financeiro')
            OR has_module_access(auth.uid(), 'estoque') ) )
with check ( ...mesma expressão... )
```

Nenhuma mudança de front-end é necessária — `estoque.a-receber.tsx` já usa `AnexoViewer` / `baixarAnexo` corretamente contra `demanda-anexos`.

## Escopo
- Somente políticas de storage do bucket `demanda-anexos`.
- Sem alterações em UI, em outras tabelas ou em `compra-anexos` (já OK).
- Usuários exclusivamente do módulo Financeiro continuam com o mesmo acesso; usuários do Estoque ganham leitura/gravação equivalente, necessária para visualizar e (quando aplicável) baixar os anexos vindos das demandas migradas para "A Receber".
