# Como testar a integração com Dropbox

## O que será testado

Verificar se, ao concluir um contrato no módulo Jurídico, o sistema cria automaticamente a estrutura de pastas no Dropbox e envia os documentos para `04 - DOC`.

## Passos para testar

1. **Criar/escolher um contrato no Jurídico**
   - Acesse o módulo Jurídico.
   - Crie um novo contrato ou abra um contrato existente.
   - Preencha obrigatoriamente: **Título do evento**, **Local do evento** e **Data de início do evento** (ano/mês definem a pasta).

2. **Anexar a proposta e o contrato**
   - No card do contrato, anexe a **proposta** (obrigatória para avançar).
   - Anexe também o **contrato** (ou contrato assinado, se já houver).

3. **Escolher o fluxo de assinatura**
   - Ao clicar em "Enviar para assinatura", escolha **"Sim"** para Clicksign ou **"Não"** para assinatura interna.
   - Se escolher Clicksign, aguarde a assinatura ser concluída (webhook).
   - Se escolher interno, basta ter proposta + contrato anexados.

4. **Mover o card para Concluído**
   - Arraste o card para a coluna **Concluído** ou use a ação de conclusão.
   - O assistente "Concluir contrato" será aberto.

5. **Executar a etapa "Pastas no Dropbox"**
   - No assistente, confira a prévia do caminho que será criado.
   - Clique em **"Criar pastas e enviar arquivos"**.
   - Aguarde a conclusão. Ao final, o link da pasta no Dropbox será exibido.

6. **Validar no Dropbox**
   - Acesse sua conta do Dropbox.
   - Verifique se a pasta foi criada em:
     ```text
     /EVENTOS DA SEMANA/<ANO>/<NN - MÊS>/<PERÍODO - NOME DO EVENTO - LOCAL>/
     ```
   - Dentro dela, confirme as subpastas:
     ```text
     01 - REUNIÃO FINAL
     02 - PROJETO
     03 - COMUNICAÇÃO VISUAL
     04 - DOC
     05 - ARQUIVOS RECEBIDOS
     06 - ROUTER
     ```
   - Verifique se os arquivos (contrato/proposta) foram enviados para `04 - DOC`.

7. **Validar no sistema**
   - O contrato deve ter os campos `dropbox_path` e `dropbox_url` preenchidos.
   - Se concluir o mesmo contrato novamente, o sistema deve reaproveitar a pasta existente e não duplicar.

## Observações importantes

- O preview já está com as credenciais configuradas; para produção, publique o app.
- Se o contrato não tiver data de início do evento, o caminho não poderá ser montado.
- Se houver erro de permissão no Dropbox, verifique se as permissões `files.content.write`, `files.content.read` e `sharing.write` estão marcadas no Dropbox App Console.
