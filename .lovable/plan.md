# Converter card: Compra ⇄ Despesa no Quadro de Compras

Hoje o quadro tem dois tipos de card (Compra e Despesa/Aquisição) e não há como trocar um pelo outro depois de criado — só refazer o card à mão. A ideia é permitir a conversão nos dois sentidos, levando tudo que já foi preenchido.

## Como vai funcionar

- Dentro do card aberto (Compra ou Despesa) aparece a ação **Converter em Despesa** / **Converter em Compra**, disponível para quem já pode editar aquele card (responsável, criador ou admin).
- Ao clicar, abre uma confirmação que pergunta:
  - indo para **Despesa**: qual o **tipo de despesa** (lista dinâmica atual). O tipo escolhido define se o card usa **grade de itens** ou **descritivo**.
  - indo para **Compra**: qual o **tipo de compra** (Mercadoria ou Serviço).
- A conversão leva tudo do card original:
  - dados gerais: título, solicitante (e e-mail), fornecedor, comprador, documento, datas (solicitação, compra), valor total, condição de pagamento/parcelamento, NF (tem NF, números), observações, responsável, prazo, status financeiro, origem e vínculo com ordem de produção;
  - **itens**, **anexos**, **formas de pagamento/parcelas** (incluindo pago e datas) e **comentários** (com autor e data originais);
  - o card entra na **mesma coluna** (mesmo status) em que estava.
- Regra de itens: se o tipo de despesa escolhido **não usa itens**, os itens são convertidos em um resumo de texto no campo **Descritivo** (ex.: `2 x Chapa MDF 15mm — R$ 250,00`), e nada mais precisa ser digitado. No caminho inverso (Despesa descritiva → Compra), o descritivo é mantido nas observações do card de compra.
- O card recebe um **novo código** (ex.: COMPRA-120 vira DESPESA-45) e fica registrada a origem: uma linha no histórico e uma nota "Convertido de COMPRA-120".
- O card antigo só é removido depois que o novo, com anexos e demais registros, for criado com sucesso. Se algum anexo falhar na cópia, a conversão é interrompida com aviso e nada é apagado.

## Detalhes técnicos

- Novo componente `src/components/ConverterCardDialog.tsx`, acionado a partir de `CompraDialog.tsx` e `DemandaDialog.tsx` (botão no rodapé, mesma condição de `canEditCompra`/edição já usada em cada diálogo). Após converter, o diálogo fecha e o quadro reabre o card novo.
- Lógica em `src/lib/compras-conversao.ts`:
  - `compraParaDemanda(compraId, tipoDemanda)` e `demandaParaCompra(demandaId, tipoCompra)`;
  - mapeamento de colunas entre `compras` e `demandas` (campos exclusivos: `data_servico`/`empresa_faturada` só em compras — vão para observações; `evento_projeto`/`descritivo` só em demandas);
  - itens: `compra_itens` ⇄ `demanda_itens` (`outros` ⇄ `outros_custos`, `desconto` só em demanda_itens; `cotacao`, `desconto_percentual`, `ipi`, `frete`, `evento_projeto` existem nos dois);
  - anexos: download do bucket de origem e upload no destino com caminho `<novo_id>/<timestamp>_<nome_higienizado>` (padrão exigido pela policy `storage_folder_uuid`), preservando `nome`, `mime_type`, `tamanho`, `tipo`;
  - pagamentos e comentários copiados 1:1;
  - limpeza final: remove arquivos do bucket de origem, linhas filhas e o card original.
- `useTiposDespesa()` fornece a lista de tipos e `exigeItens(slug)` para decidir itens x descritivo.
- Numeração usa as sequências/triggers já existentes de cada tabela (`numero`).
- Sem mudanças de banco de dados — todas as tabelas e colunas necessárias já existem.
