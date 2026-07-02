CREATE POLICY "compras_update_pedro"
ON public.compras
FOR UPDATE
TO authenticated
USING  (auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid)
WITH CHECK (auth.uid() = '9465f822-0273-4235-ba24-148cb1bf2c4b'::uuid);

COMMENT ON POLICY "compras_update_pedro" ON public.compras IS
  'Exceção pessoal: libera UPDATE em compras para o usuário Pedro (user_id fixo). Atualizar se a conta mudar.';