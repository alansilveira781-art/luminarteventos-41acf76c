# Distribuição de Comissão: mostrar e calcular pelo percentual do cadastro

## O que está acontecendo (verificado nos dados)

O relatório apenas exibe a comissão **gravada** em cada venda, e muitas estão zeradas:

- Sem ficha em Configurações (logo, 0%): André (103 vendas), Maicon (72), MAICON (3), Gabi (1), "-" (11), sem consultor (7).
- Com ficha, mas gravadas com zero: Romulo Manoel (8 vendas, 2%) e Pádua Costa (7 de 15, 3%) — provavelmente vendas importadas ou editadas em massa antes do recálculo.
- O cadastro hoje tem só 3 vendedores: Pádua Costa (3%), Romulo Manoel (2%) e Cristiano (comissão por gatilho, percentual 0).
- O nome "Padua" (294 vendas) não é o mesmo texto de "Pádua Costa" no cadastro; hoje as duas grafias aparecem como consultores diferentes na listagem.

Não há corte de linhas: o relatório carrega todas as vendas em páginas de 1000.

## O que muda no relatório

- A comissão passa a ser **calculada na hora** pelo percentual do cadastro (valor final x % do vendedor), em vez de usar o valor gravado. Quando a venda já tem comissão gravada diferente, o relatório usa o cálculo do cadastro e marca a linha.
- O casamento do nome do consultor com o cadastro ignora maiúsculas, acentos e espaços (Padua = Pádua Costa, MAICON = Maicon), unificando os grupos por vendedor.
- Vendedores com comissão por gatilho (ex.: Cristiano) continuam sem percentual direto; a linha fica zerada e aparece a indicação "comissão por gatilho".
- Aviso no topo listando os consultores sem cadastro e quantas vendas/valor estão fora do cálculo, para deixar claro por que não geram comissão.
- CSV e impressão passam a usar os mesmos valores calculados.

## Detalhes técnicos

- `src/routes/comercial.relatorios.tsx`: buscar `comercial_vendedores` (`listCadastro`/query já usada no formulário) e, em `grupos`, chavear por `matchCadastro(r.consultor, vendedores)?.nome ?? cleanText(r.consultor)`; calcular `valorComissao` com `calcularDerivados` de `src/lib/comercial/comissao.ts` (só a parte de comissão), mantendo `valorFinal` do registro.
- Sem mudança de banco; nada é regravado — o botão "Recalcular comissões/BV" na aba Vendas segue sendo o caminho para persistir.
