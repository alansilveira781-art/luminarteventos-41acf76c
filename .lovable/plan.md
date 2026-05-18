# Plano — Impressão de Proposta + Catálogo de Descrições

## 1. Catálogo de Descrições (novo)

### Tipos de medida suportados
- **unidade** — campos: `quantidade`, `valorUnitario` → subtotal = `qtde × valor`
- **dimensional** — campos: `largura`, `altura`, `comprimento`, `quantidade`, `valorUnitario` → subtotal = `valor × (L × A × C) × qtde`
- **area** — campos: `largura`, `comprimento`, `quantidade`, `valorM2` → subtotal = `valor × (L × C) × qtde`
- **linear** — campos: `comprimento`, `quantidade`, `valorMetro` → subtotal = `valor × C × qtde`

### Estrutura de dados (`src/lib/comercial/types.ts`)
```ts
type TipoMedida = "unidade" | "dimensional" | "area" | "linear";

type CatalogoDescricao = {
  id: string;
  nome: string;          // ex: "Painel de LED 4x2"
  tipoMedida: TipoMedida;
  valorUnitario: number; // valor pré-definido (editável na proposta)
  createdAt: string;
};

// Substitui o atual DescricaoItem
type DescricaoItem = {
  id: string;
  catalogoId: string | null; // referência ao catálogo (selecionável)
  descricao: string;         // nome (cópia no momento da seleção)
  tipoMedida: TipoMedida;
  largura?: number;
  altura?: number;
  comprimento?: number;
  quantidade: number;
  valorUnitario: number;
};
```
Adicionar helper `descricaoSubtotal(d)` com switch por `tipoMedida` e migração no `store.ts` (descrições antigas viram `tipoMedida: "unidade"`).

### Nova rota: `/comercial/catalogo` (`src/routes/comercial.catalogo.tsx`)
- Tabela com colunas: Nome, Tipo de medida, Valor unitário, Ações (editar/excluir)
- Dialog de criar/editar com `Select` de tipo de medida + `NumberInput` para valor
- Persistido no `localStorage` (mesmo padrão do `store.ts` atual)
- Link na sidebar dentro do grupo Comercial

## 2. Wizard de Proposta — passo Itens

No passo "Itens" (`PropostaWizard.tsx`), dentro de cada **Item**:
- Botão **"+ Adicionar descrição"** abre `Select` com as descrições do catálogo (com busca / `Command`)
- Ao escolher uma descrição do catálogo:
  - copia `nome`, `tipoMedida`, `valorUnitario` para a `DescricaoItem`
  - renderiza apenas os campos relevantes ao tipo (ex.: dimensional mostra L/A/C/qtde; unidade só qtde)
- Valor unitário fica **editável** na proposta (pode sobrescrever o padrão)
- Subtotal por descrição usa o novo helper

Catálogo vazio? Mostrar CTA "Cadastrar no Catálogo →" linkando para a nova rota.

## 3. Nova impressão de proposta (PDF)

Reescrever `src/lib/comercial/pdf.ts` com layout limpo:

### Página 1 — Capa / Dados essenciais
- Cabeçalho minimalista (logo + nº proposta + data)
- Bloco **Cliente**: nome, telefone, email
- Bloco **Evento**: tipo, período, local, cidade, observações
- Bloco **Consultor(a)** + validade
- Rodapé com contato

### Páginas 2..N — Uma por Ambiente
Layout em duas colunas:
- **Esquerda (≈45% da largura):** primeira imagem do ambiente, ocupando boa altura, com legenda discreta "Ambiente: {nome}"
- **Direita (≈55%):** lista de itens
  - Nome do item em **negrito**
  - Descrições abaixo em *itálico*, com a medida formatada conforme o tipo:
    - unidade: `2× Painel LED — R$ 1.500,00 = R$ 3.000,00`
    - dimensional: `4,00 × 2,00 × 0,50 m × 2 un — R$ 200,00/un = R$ 1.600,00`
    - area: `4,00 × 2,00 m² × 1 — R$ 150,00/m² = R$ 1.200,00`
    - linear: `10,00 m × 1 — R$ 50,00/m = R$ 500,00`
  - Subtotal do ambiente em destaque no final
- Quebra de página automática entre ambientes (`doc.addPage()` por ambiente)
- Imagens redimensionadas mantendo proporção; fallback "Sem imagem" se vazio

### Última página — Resumo financeiro
- Subtotal ambientes, custos (frete/montagem/desmontagem/outros), Total final em destaque
- Validade da proposta

Numeração "Página X de Y" no rodapé.

## 4. Onde disparar a impressão

Adicionar botão "Imprimir PDF" (ícone `Printer`/`FileDown`) chamando `gerarPropostaPDF(proposta)`:
1. **Card do Kanban** (`comercial.index.tsx`) — só aparece quando o card tem `propostaId`; busca a proposta no store
2. **Drawer de Detalhes** (`DetalhesDrawer.tsx`) — botão no rodapé quando há proposta vinculada
3. **Aba Propostas** (`comercial.propostas.tsx`) — já existe, apenas usar a nova função

## 5. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/comercial/types.ts` | `TipoMedida`, `CatalogoDescricao`, novo `DescricaoItem`, helpers de subtotal |
| `src/lib/comercial/store.ts` | CRUD `catalogo`, migração de descrições antigas |
| `src/lib/comercial/pdf.ts` | Reescrita completa (capa + 1 ambiente/página + resumo) |
| `src/routes/comercial.catalogo.tsx` | **novo** — CRUD do catálogo |
| `src/routes/comercial.tsx` | adicionar tab/link "Catálogo" |
| `src/components/AppSidebar.tsx` | item de menu (se aplicável) |
| `src/components/comercial/PropostaWizard.tsx` | seletor de descrição via catálogo, campos por tipo |
| `src/components/comercial/DetalhesDrawer.tsx` | botão "Imprimir PDF" |
| `src/routes/comercial.index.tsx` | botão imprimir no card |

## 6. Pontos em aberto (assumidos)
- Catálogo e descrições continuam em `localStorage` (mesmo padrão atual). Migrar para Lovable Cloud é trabalho separado.
- Imagens dos ambientes seguem como data URL (já implementado).
- Dimensões em metros; valores em BRL.
- Se o ambiente tiver várias imagens, a página usa a 1ª (futuras imagens podem virar páginas extras — fora do escopo).