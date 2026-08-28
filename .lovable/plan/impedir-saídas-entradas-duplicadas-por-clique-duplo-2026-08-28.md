# Impedir saídas/entradas duplicadas por clique duplo

## O problema

Nos formulários de **Saída** e **Entrada** do Estoque o botão só é desabilitado depois que o React renderiza de novo com o estado "salvando". Entre o primeiro clique e essa re-renderização (e também no toque duplo em celular/tablet), um segundo clique ainda chega ao formulário e dispara um segundo lançamento — gerando duas requisições (REQ) com os mesmos itens.

O botão hoje mostra "Salvando…" e fica desabilitado, mas essa proteção chega tarde demais e não cobre o toque duplo rápido.

## O que será feito

Apenas travamento do envio — nenhuma alteração de regra, layout ou dados:

- Trava imediata no momento do clique: o formulário passa a ignorar qualquer envio adicional enquanto o anterior não terminar (trava síncrona, não depende de re-renderização).
- Botão desabilitado do primeiro clique até o fim da operação, com o texto "Salvando…".
- A trava é liberada quando a operação termina — tanto no sucesso quanto no erro —, então em caso de falha a pessoa pode tentar de novo normalmente.
- Bloqueio de envio por tecla Enter enquanto estiver salvando.

Aplicado nos quatro formulários envolvidos:
- Registrar saída e editar saída (`/saidas`)
- Registrar entrada e editar entrada (`/entradas`)

## Detalhes técnicos

- Em `src/routes/saidas.tsx` (`SaidaForm`, `SaidaEditForm`) e `src/routes/entradas.tsx` (`EntradaForm`, `EntradaEditForm`): adicionar um `useRef` de "enviando" checado/setado no início do `onSubmit`, antes de chamar `onSubmit(...)`, e resetado por `useEffect` quando a prop `submitting` volta a `false`.
- Manter `disabled={submitting || enviandoRef.current}` no botão de submit.
- Sem mudanças nas mutations, no banco, nas policies ou no cálculo de estoque.
