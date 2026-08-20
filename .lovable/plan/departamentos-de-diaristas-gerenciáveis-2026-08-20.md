# Departamentos de diaristas gerenciáveis

Hoje os departamentos são uma lista fixa no código (`Marcenaria`, `Estrutura`, `Iluminação`), então qualquer novo departamento exige alteração de código. A ideia é transformar isso em um cadastro editável dentro do próprio módulo.

## O que muda

- Nova seção **Departamentos** em Financeiro > Diaristas > Configurações: listar, adicionar, renomear e remover departamentos (admins do Financeiro).
- O select de Departamento no cadastro do diarista e os filtros das abas Apontamento e Fechamento passam a ler essa lista.
- A lista já nasce com **Marcenaria, Estrutura, Iluminação e Produção de Eventos**.
- Remover um departamento não apaga diaristas: quem estiver nele continua com o valor gravado e ele aparece no filtro como opção existente.

## Detalhes técnicos

**Banco (migração):**
- Tabela `public.diarista_departamentos (id uuid pk, nome text not null unique, ordem int default 0, created_at timestamptz default now())`.
- GRANT `SELECT` para `authenticated`, `INSERT/UPDATE/DELETE` para escrita admin, `ALL` para `service_role`; RLS habilitada: leitura para autenticados (inclui lançadores via `pode_lancar_diaria`), escrita apenas para admin/admin do módulo `financeiro_op`.
- INSERTs literais dos 4 nomes iniciais na mesma migração.

**Frontend:**
- `src/lib/diaristas-config.ts`: hook `useDiaristaDepartamentos()` retornando os nomes ordenados.
- `src/routes/financeiro-op.diaristas.configuracoes.tsx`: remover a constante `DEPARTAMENTOS`, usar o hook no select e adicionar o card de gerenciamento (input + lista com editar/excluir e confirmação).
- `src/routes/financeiro-op.diaristas.index.tsx`: substituir `DEPARTAMENTOS_DIARISTA` pelo hook nos dois filtros, unindo com os departamentos já presentes nos diaristas carregados para não perder opções antigas.
- `src/lib/diaristas-pdf.ts` continua recebendo o departamento como texto — sem mudança.
