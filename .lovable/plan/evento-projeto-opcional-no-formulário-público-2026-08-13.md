# Evento / Projeto opcional no formulário público

## O que muda

No formulário público `/solicitar`, o campo **Evento / Projeto** de cada item deixa de ser obrigatório: a pessoa pode enviar o pedido sem escolher evento, e o botão de avançar/enviar não fica mais travado por causa desse campo.

A obrigatoriedade continua existindo internamente: ao mover um card de Compra para **Pendente Aprovação**, o sistema segue exigindo que todos os itens tenham Evento / Projeto preenchido (validação já existente no Quadro de Compras).

## Detalhes técnicos

- `src/routes/solicitar.tsx`:
  - Remover a checagem de `evento_projeto` vazio em `itemInvalido()`.
  - Trocar o rótulo "Evento / Projeto *" por "Evento / Projeto (opcional)" — sem asterisco vermelho.
  - O envio continua gravando `evento_projeto: null` quando não preenchido.
- Nenhuma mudança em banco de dados, no endpoint `api/public/solicitar` (o schema já aceita opcional/nulo) nem na validação de status em `src/routes/compras.index.tsx`.
