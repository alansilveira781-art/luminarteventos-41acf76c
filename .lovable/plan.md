# Contrato do Clicksign: campos preenchidos e papel timbrado Luminart

Dois problemas no PDF que chegou ao cliente: o texto foi enviado com os campos do modelo ainda vazios (aparecem os marcadores tipo `[cliente_nome]`) e o timbrado não é o oficial. Este plano corrige os dois.

## 1. Campos preenchidos no PDF enviado

Hoje o PDF é gerado a partir do `corpo_html` gravado no card. Esse HTML só é preenchido no momento em que o card passa por "Mover para Criação"; se o contrato foi criado direto a partir de um modelo, ou se os dados (cliente, valores, parcelas, período do evento, endereço, testemunhas) foram editados depois, o texto continua com os marcadores originais.

Correção: no momento do envio para assinatura, o contrato é sempre re-renderizado com os dados atuais do card — os mesmos campos automáticos usados na tela de Criação, mais os valores preenchidos manualmente que já ficam salvos no contrato. Qualquer marcador que continuar sem valor:

- se for um campo obrigatório do contrato, o envio é bloqueado com uma mensagem dizendo exatamente quais campos faltam preencher;
- caso contrário, o marcador é removido em vez de aparecer no documento assinado.

O diálogo de envio passa a mostrar uma prévia do contrato já preenchido, para conferência antes de disparar os e-mails.

## 2. Papel timbrado oficial

O PDF passa a usar o timbrado do arquivo enviado:

- Logo Luminart no topo de todas as páginas (mesma proporção do documento: ~5,7 cm de largura).
- Rodapé em todas as páginas: "Av. Maestro Lisboa, 2181 — Lagoa Redonda — Fortaleza / CE — CEP 60810-670" e "Fone: (85) 9.9933-1605 • contato@luminarteventos.com.br", com numeração de página.
- Margens A4 ajustadas para o texto não invadir cabeçalho e rodapé.

O mesmo timbrado passa a valer também na impressão/geração local do contrato, para o documento na tela ser idêntico ao enviado à assinatura.

## Detalhes técnicos

- `src/lib/juridico/contrato-pdf.ts`: adicionar cabeçalho (imagem) e rodapé em cada página; margem superior/inferior maior; contagem "Página X de Y". A logo entra como asset do projeto (extraída do `.docx`) e é embutida no jsPDF.
- `src/components/juridico/EnviarAssinaturaDialog.tsx`: antes de gerar o PDF, aplicar `variaveisDoContrato(contrato, empresa)` + `variaveis_valores` via `renderizarModelo` (de `@/lib/juridico/modelo-render`), buscar a empresa contratada do contrato, listar marcadores pendentes e exibir prévia.
- `src/lib/juridico/modelo-render.ts`: helper para listar marcadores remanescentes e limpar os opcionais.
- Sem mudanças de banco e sem alteração no fluxo de webhook/status.
