# Nome do documento no Clicksign: evento e local

Hoje o documento chega ao Clicksign com o nome do arquivo gerado a partir do título do card (e ainda passa por uma limpeza que troca acentos, espaços e traços por `_`, resultando em algo como `1787160246243_TESTE.pdf`).

## O que muda

O nome do documento passa a ser montado a partir dos dados do evento do contrato:

`NOME DO EVENTO - LOCAL` (ex.: `ANIVERSÁRIO ALAN - LA MAISON`)

Regras:
- Se houver nome do evento e local, usa os dois separados por " - ", em maiúsculas.
- Se só houver um dos dois, usa o que existir.
- Se nenhum estiver preenchido, mantém o título do contrato como hoje.
- Sem prefixo numérico visível no nome (o carimbo de data continua só no caminho interno, não no nome exibido).

## Detalhes técnicos

- `src/components/juridico/EnviarAssinaturaDialog.tsx`: calcular `nomeArquivo` a partir de `contrato.evento_nome` / `contrato.evento_local` (fallback `titulo`) e usar esse nome também no PDF gerado localmente.
- `src/lib/juridico/clicksign.server.ts` (`criarDocumento`): afrouxar a limpeza do nome — remover acentos e caracteres inválidos, mas preservar espaços e hífens, e manter o timestamp apenas na pasta (`/Contratos/<timestamp>/<nome>.pdf`) para o nome exibido ficar legível.
- Sem mudanças de banco, webhook ou fluxo de status.
