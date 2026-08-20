# Criar pastas no Dropbox ao concluir o contrato

## Como funciona a conexão

Não é preciso "conectar ao Claude". A integração é direta com a API oficial do Dropbox, feita pelo servidor do próprio app. Você cria um app no Dropbox (App Console), gera as credenciais e eu as guardo com segurança nos segredos do projeto:

- `DROPBOX_APP_KEY`
- `DROPBOX_APP_SECRET`
- `DROPBOX_REFRESH_TOKEN` (token de acesso permanente, com permissão `files.content.write`)

Vou pedir esses valores por um formulário seguro no momento da implementação, com o passo a passo de onde obtê-los. O caminho `C:\Users\AlanS\Dropbox\...` é a pasta local sincronizada; na API ela vira `/EVENTOS DA SEMANA/...` — as pastas criadas aparecem automaticamente no seu computador pelo sincronizador do Dropbox.

## Estrutura criada

```text
/EVENTOS DA SEMANA/2026/08 - AGOSTO/
   PERÍODO DO EVENTO - NOME DO EVENTO - LOCAL DO EVENTO/
      01 - REUNIÃO FINAL
      02 - PROJETO
      03 - COMUNICAÇÃO VISUAL
      04 - DOC        <- contrato assinado + proposta
      05 - ARQUIVOS RECEBIDOS
      06 - ROUTER
```

- Ano e mês vêm da **data do evento** do contrato (mês em `NN - MÊS` maiúsculo).
- Período do evento formatado a partir das datas de início/fim (ex.: `20 A 22.08`; se for um só dia, `22.08`).
- Nomes normalizados em maiúsculas, sem caracteres inválidos para o Dropbox.
- Se a pasta já existir, ela é reaproveitada (não duplica).

## Onde entra no fluxo

Ao mover um contrato para **Concluído**, o assistente atual ganha uma terceira etapa: **Pastas no Dropbox**.

- Mostra a prévia do caminho completo e o nome da pasta, com os campos editáveis (período, nome, local, ano/mês) caso queira corrigir.
- Botão "Criar pastas e enviar arquivos" e botão "Pular".
- Sobe para `04 - DOC` os anexos do card: contrato assinado (ou contrato do fluxo interno) e a proposta.
- Ao final, mostra o link da pasta criada e grava no contrato o caminho, para não recriar caso o card seja concluído de novo.

## Detalhes técnicos

- `src/lib/juridico/dropbox.server.ts`: cliente da API Dropbox (troca do refresh token por access token, `files/create_folder_v2`, `files/upload`, `sharing/create_shared_link_with_settings`), com tratamento de `conflict/folder` como sucesso.
- `src/lib/juridico/dropbox.functions.ts`: server function `criarPastasContrato` protegida por `requireSupabaseAuth`, que monta os caminhos, cria as pastas, baixa os anexos do bucket `juridico-anexos` e envia para `04 - DOC`.
- `src/lib/juridico/dropbox-paths.ts` (client-safe): funções puras de formatação de ano, mês, período e nome da pasta, usadas na prévia da UI.
- Nova etapa em `src/components/juridico/ConcluirContratoWizard.tsx` (passa de 2 para 3 passos).
- Migration: colunas `dropbox_path` (text) e `dropbox_url` (text) em `juridico_contratos`.
