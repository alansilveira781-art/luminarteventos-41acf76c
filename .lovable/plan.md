## Problema
Ao criar uma proposta no Quadro de Vendas, o `PropostaWizard` volta para a etapa 1 e perde os dados preenchidos quando o usuário dá Alt+Tab ou interage com a tela. A causa raiz é:

1. `src/routes/comercial.index.tsx` passa a prop `defaults` ao `PropostaWizard` através de uma IIFE que cria um objeto novo a cada render do pai.
2. O `useEffect` de reset dentro de `PropostaWizard` depende de `defaults`, então cada re-render do pai dispara o effect e executa `setStep(0)`, resetando o formulário.

## Solução

### Correção 1 — Memoizar defaults no pai
No arquivo `src/routes/comercial.index.tsx`:
- Garantir que `useMemo` esteja importado de `react` (já está, mas confirmar).
- Antes do JSX que renderiza `<PropostaWizard />`, criar uma variável `wizardDefaults` com `useMemo` que computa o objeto apenas quando `wizardCardId` ou `cards` mudarem.
- Substituir o `defaults={(() => { ... })()}` inline por `defaults={wizardDefaults}`.

```typescript
const wizardDefaults = useMemo(() => {
  const c = cards.find((x) => x.id === wizardCardId);
  if (!c) return undefined;
  return {
    clienteNome: c.clienteNome,
    eventoNome: c.eventoNome,
    eventoDataInicio: c.eventoDataInicio,
    eventoDataFim: c.eventoDataFim,
    responsavel: c.responsavel,
  };
}, [wizardCardId, cards]);
```

### Correção 2 — Blindar o effect de reset no wizard
No arquivo `src/components/comercial/PropostaWizard.tsx`:
- Adicionar `useRef` ao import do React.
- Criar um ref `const initialized = useRef(false);` dentro do componente.
- Alterar o `useEffect` de reset para rodar apenas na transição de `open` de `false` para `true` e quando `initialized.current === false`.
- Ao abrir, executar a inicialização normalmente (`setStep(0)` e todos os setters) e marcar `initialized.current = true`.
- Ao fechar (`open === false`), resetar `initialized.current = false`.
- Manter a dependência do effect como `[open]` apenas, removendo `proposta` e `defaults` do array.

```typescript
const initialized = useRef(false);

useEffect(() => {
  if (!open) {
    initialized.current = false;
    return;
  }
  if (initialized.current) return;
  initialized.current = true;

  setStep(0);
  if (proposta) {
    setCliente(proposta.cliente);
    setEvento(proposta.evento);
    setAmbientes(proposta.ambientes?.length ? proposta.ambientes : [newAmbiente("Ambiente principal")]);
    setCustos(proposta.custos);
    setResumo(proposta.resumo);
    setResponsavel(proposta.responsavel);
  } else {
    setCliente({
      nome: defaults?.clienteNome ?? "",
      telefone: defaults?.clienteTelefone ?? "",
      email: defaults?.clienteEmail ?? "",
    });
    setEvento({
      tipo: "",
      dataInicio: defaults?.eventoDataInicio ?? "",
      dataFim: defaults?.eventoDataFim ?? defaults?.eventoDataInicio ?? "",
      local: defaults?.eventoNome ?? "",
      cidade: "",
      observacoes: "",
    });
    setAmbientes([newAmbiente("Ambiente principal")]);
    setCustos({ frete: 0, montagem: 0, desmontagem: 0, outros: [] });
    setResumo({ margem: 0, validade: "" });
    setResponsavel(defaults?.responsavel ?? "");
  }
}, [open]);
```

## Escopo
- Apenas os arquivos `src/routes/comercial.index.tsx` e `src/components/comercial/PropostaWizard.tsx` serão alterados.
- Nenhuma outra lógica será modificada: navegação entre etapas, validações (`canNext`), cálculos (`subtotalAmbientes`, `totalFinal`) e salvamento permanecem idênticos.
- Após a aprovação, será executado `bunx tsc --noEmit` para validação de tipos.