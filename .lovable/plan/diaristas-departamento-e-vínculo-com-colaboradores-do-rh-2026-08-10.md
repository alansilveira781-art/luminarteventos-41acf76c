# Diaristas: departamento e vínculo com colaboradores do RH

## O que muda

### 1. Departamento no cadastro do diarista
No cadastro de diarista (Financeiro > Diaristas > Configurações) entra o campo **Departamento**, com as opções **Marcenaria** e **Estrutura** (mais "Não informado"). A coluna aparece na tabela de diaristas cadastrados.

### 2. Vínculo opcional com o RH
No mesmo cadastro entra o campo **Colaborador (RH)**, uma lista de busca com os colaboradores ativos cadastrados em Recursos Humanos. Ao escolher um colaborador:
- o **nome** é preenchido automaticamente com o nome dele;
- o **apelido** é preenchido, se o colaborador tiver;
- o **departamento** é preenchido com o departamento do colaborador (podendo ser ajustado à mão).

O campo é opcional: quem não estiver no RH continua sendo cadastrado digitando o nome normalmente.

### 3. Filtro por departamento
Um filtro **Departamento** (Todos / Marcenaria / Estrutura / Sem departamento) é adicionado em:
- aba **Apontamento** — filtra as linhas lançadas pelo departamento do diarista;
- aba **Fechamento** — filtra os diaristas somados no fechamento; o filtro também é respeitado na exportação em PDF, que passa a mostrar o departamento junto ao nome.

## Detalhes técnicos

**Banco (migração):**
- `public.diaristas`: novas colunas `departamento text` (livre, alimentada pelo RH ou pelas opções fixas) e `colaborador_id uuid REFERENCES public.rh_colaboradores(id) ON DELETE SET NULL`, ambas nulas; índice em `departamento`.
- Nenhuma mudança de RLS: as policies existentes de `diaristas` já cobrem as novas colunas. Leitura de `rh_colaboradores` já é permitida para autenticados — confirmar na migração e, se necessário, apenas garantir SELECT para lançadores de diária via policy adicional.

**Frontend:**
- `src/routes/financeiro-op.diaristas.configuracoes.tsx`: campos Colaborador (combobox com busca em `rh_colaboradores` ativos) e Departamento (Select) no diálogo; nova coluna Departamento na tabela; preenchimento automático ao escolher colaborador.
- `src/routes/financeiro-op.diaristas.index.tsx`: consulta de diaristas passa a trazer `departamento`; novo Select de filtro aplicado às listas de Apontamento e Fechamento.
- `src/lib/diaristas-pdf.ts`: exibe o departamento no relatório e recebe o filtro aplicado no cabeçalho.
