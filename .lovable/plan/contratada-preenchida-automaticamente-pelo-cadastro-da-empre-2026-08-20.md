# Contratada preenchida automaticamente pelo cadastro da empresa

Hoje o bloco "Contratada (Luminart)" do envio para assinatura é editável e usa um valor guardado no navegador (por isso apareceu o e-mail `alansilveira781@gmail.com` no lugar do e-mail do Maicon). Passa a ser somente leitura e alimentado pelo cadastro da empresa em Administração > Empresas.

## O que muda

1. **Cadastro de empresa ganha os dados de assinatura**
   - Novos campos no formulário de empresa: E-mail do representante e Telefone do representante (ao lado do nome e do CPF que já existem).
   - Esses campos são os que alimentam o contrato e a assinatura eletrônica.
   - O cadastro da Luminart é preenchido com os dados do Maicon (nome, CPF 040.270.053-84, e-mail maicon@luminarteventos.com.br, telefone (85) 9.9933-1605).

2. **Bloco da Contratada no envio para assinatura**
   - Nome, e-mail e CPF passam a vir sempre do cadastro da empresa (com os dados fixos da Luminart como reserva), exibidos em modo somente leitura, sem botão de excluir.
   - O valor antigo guardado no navegador deixa de ser usado e não é mais gravado.
   - Uma linha de apoio indica que a alteração é feita em Administração > Empresas.

3. **Campos automáticos do contrato** continuam usando as mesmas informações, agora sempre coerentes com o cadastro.

## Detalhes técnicos

- Migração: adicionar `representante_email` e `representante_telefone` (text, nulos) em `admin_empresas`; atualização de dados da Luminart via insert/update.
- `src/routes/admin.empresas.tsx`: dois campos novos no diálogo e no payload de salvar.
- `src/components/juridico/EnviarAssinaturaDialog.tsx`: incluir as duas colunas no `select`; montar o signatário "contratada" a partir de `empresa` + `CONTRATADA_PADRAO` num `useEffect` dependente de `empresa`; remover leitura/escrita do `localStorage` `clicksign-contratada:*`; renderizar esse signatário com inputs `readOnly`/`disabled` e sem ação de remover.
- `src/lib/juridico/modelo-render.ts`: sem mudança de lógica (o merge empresa → `CONTRATADA_PADRAO` já existe).
