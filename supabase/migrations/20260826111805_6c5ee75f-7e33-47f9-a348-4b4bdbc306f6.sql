-- 1) copia nomes da lista antiga para a lista única
INSERT INTO public.comercial_produtores (nome, ativo)
SELECT p.nome, true FROM public.produtores p
WHERE NOT EXISTS (
  SELECT 1 FROM public.comercial_produtores c WHERE lower(btrim(c.nome)) = lower(btrim(p.nome))
);

-- 2) remapeia os vínculos existentes (ids antigos -> ids da lista única) pelo nome
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_produtor_id_fkey;

UPDATE public.eventos e
SET produtor_id = c.id
FROM public.produtores p
JOIN public.comercial_produtores c ON lower(btrim(c.nome)) = lower(btrim(p.nome))
WHERE e.produtor_id = p.id;

UPDATE public.eventos e
SET produtor_id = NULL
WHERE e.produtor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.comercial_produtores c WHERE c.id = e.produtor_id);

-- 3) preenche vínculos vazios pelo nome gravado no evento
UPDATE public.eventos e
SET produtor_id = c.id
FROM public.comercial_produtores c
WHERE e.produtor_id IS NULL
  AND COALESCE(e.produtor_terceirizado, false) = false
  AND e.produtor IS NOT NULL
  AND lower(btrim(e.produtor)) = lower(btrim(c.nome));

-- 4) nova FK apontando para a lista única
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_produtor_id_fkey
  FOREIGN KEY (produtor_id) REFERENCES public.comercial_produtores(id) ON DELETE SET NULL;