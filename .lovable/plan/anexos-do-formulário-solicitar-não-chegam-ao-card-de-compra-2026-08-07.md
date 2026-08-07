# Anexos do formulário /solicitar não chegam ao card de Compra

## O que já foi verificado

- O formulário público envia os arquivos corretamente (multipart, campo `anexos`) tanto para compra quanto para despesa.
- O endpoint público grava a compra e os itens normalmente — as compras enviadas nos últimos dias existem, mas sem anexos.
- Os arquivos enviados pelo formulário público ficam no armazenamento sem "dono" (owner nulo). O último arquivo público de **compra** é de 05/08 16:29, enquanto o último público de **despesa** é de 06/08 19:38. Ou seja: o caminho de despesa continuou funcionando e o de compra parou de registrar arquivos.
- A leitura no card está correta: o diálogo da compra lista `compra_anexos` daquela compra, sem filtro extra. Logo, o problema está no envio/gravação, não na exibição.
- Causa exata ainda **não confirmada** — hoje o servidor engole a falha de cada arquivo (só conta quantos falharam) e o formulário mostra apenas um aviso genérico, então não há registro do motivo real.

## Plano

1. **Reproduzir com envio de teste**: fazer um POST de compra com arquivo contra o endpoint público em ambiente de desenvolvimento e capturar o erro real do upload (mensagem/status do armazenamento). Isso confirma a causa antes de qualquer correção.
2. **Corrigir a falha encontrada** no fluxo de anexos da compra (por exemplo, erro no envio do arquivo ao bucket `compra-anexos` ou na gravação do registro do anexo). O caminho de despesa, que funciona, serve de referência.
3. **Tornar a falha visível em vez de silenciosa**:
   - O endpoint passa a devolver, junto com a resposta, o nome e o motivo de cada anexo que falhou.
   - O formulário mostra a mensagem específica ("arquivo X não pôde ser enviado: motivo") em vez do aviso genérico.
   - Registrar o erro no log do servidor com o identificador da solicitação, para diagnóstico futuro.
4. **Reenvio dos anexos perdidos**: os arquivos das solicitações já enviadas não estão no sistema (não chegaram ao armazenamento), então não há como recuperá-los automaticamente — nesses casos o anexo precisa ser adicionado manualmente pelo card. Isso será informado, sem alteração de dados históricos.
5. **Validar**: novo envio de teste de compra com 2 arquivos e conferência de que aparecem no card, e um envio de despesa para garantir que nada quebrou.

## Detalhes técnicos

- Arquivos envolvidos: `src/routes/api/public/solicitar.ts` (função `uploadAnexos` e ramo `tipo === "compra"`) e `src/routes/solicitar.tsx` (tratamento de `anexos_falhados`).
- Nenhuma mudança de banco de dados prevista; as políticas de acesso de `compra_anexos` já permitem leitura por administradores e pelo solicitante.
- Sem alterações em outros módulos (Despesas, Estoque, Quadro Financeiro) além do retorno de erro mais detalhado do endpoint compartilhado.
