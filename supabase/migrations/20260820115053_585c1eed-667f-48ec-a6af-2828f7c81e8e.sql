update public.admin_empresas
set cnpj = '14552439000131',
    endereco = coalesce(nullif(trim(endereco), ''), 'Av. Maestro Lisboa, n.º 2181, Lagoa Redonda, Fortaleza/CE'),
    representante_nome = coalesce(nullif(trim(representante_nome), ''), 'Maicon Viana de Lima'),
    representante_documento = coalesce(nullif(trim(representante_documento), ''), '04027005384')
where cnpj = '14552439000191';