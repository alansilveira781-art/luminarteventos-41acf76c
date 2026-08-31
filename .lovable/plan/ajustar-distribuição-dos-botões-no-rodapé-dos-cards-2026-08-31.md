# Ajustar distribuição dos botões no rodapé dos cards

## Problema

No rodapé do card de Compra (e de Despesa), os botões do lado esquerdo (Excluir, Copiar link, Converter em Despesa/Compra) não estão em um contêiner flexível: "Converter" usa `ml-2` inline e "Copiar link" está dentro de um `<span>` com `inline-block`, então, com pouco espaço horizontal, o botão "Converter" cai para uma segunda linha desalinhada (conforme o print), e "Salvar" fica fora de alinhamento.

## O que será feito

### 1. `src/components/CompraDialog.tsx` (rodapé)
- Trocar o `<div>` do grupo esquerdo por `<div className="flex flex-wrap items-center gap-2">`.
- Remover o `<span className="ml-2 inline-block align-middle">` ao redor de `CopiarLinkButton` e a classe `ml-2` do botão "Converter em Despesa".
- No `DialogFooter`, adicionar `gap-2` para quando os dois grupos quebrarem linha ficarem alinhados.

### 2. `src/components/DemandaDialog.tsx` (rodapé)
- Mesma alteração no grupo esquerdo: contêiner flex com `gap-2`, removendo `<span>` e `ml-2`.

## Resultado esperado

- Excluir | Copiar link | Converter ficam na mesma linha, alinhados à esquerda.
- Avançar | Cancelar | Salvar ficam alinhados à direita.
- Se a janela for estreita, os grupos quebram linha de forma organizada (botões sempre alinhados, sem um botão solto deslocado).

Nenhuma mudança de comportamento, permissão ou fluxo — apenas layout do rodapé.
