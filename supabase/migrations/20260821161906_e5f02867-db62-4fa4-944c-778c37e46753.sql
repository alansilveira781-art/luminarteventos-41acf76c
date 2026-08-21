CREATE TABLE public.demanda_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  exige_itens boolean NOT NULL DEFAULT false,
  destino_recebimento text NOT NULL DEFAULT 'nenhum',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.demanda_tipos TO anon;
GRANT SELECT, INSERT, UPDATE ON public.demanda_tipos TO authenticated;
GRANT ALL ON public.demanda_tipos TO service_role;

ALTER TABLE public.demanda_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demanda_tipos_select_all" ON public.demanda_tipos
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "demanda_tipos_insert_admin" ON public.demanda_tipos
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'financeiro_op')
  OR public.is_module_admin(auth.uid(), 'financeiro')
);

CREATE POLICY "demanda_tipos_update_admin" ON public.demanda_tipos
FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'financeiro_op')
  OR public.is_module_admin(auth.uid(), 'financeiro')
) WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'financeiro_op')
  OR public.is_module_admin(auth.uid(), 'financeiro')
);

INSERT INTO public.demanda_tipos (slug, label, exige_itens, destino_recebimento, ordem) VALUES
  ('estacionamento','Estacionamento',false,'nenhum',10),
  ('alimentacao','Alimentação',false,'nenhum',20),
  ('manutencao_galpao','Manutenção do Galpão',false,'nenhum',30),
  ('manutencao_veiculos','Manutenção de Veículos',false,'nenhum',40),
  ('combustivel','Combustível',false,'nenhum',50),
  ('manutencao_maquinario','Manutenção de Maquinário',false,'nenhum',60),
  ('manutencao_estrutura','Manutenção Estrutura',false,'nenhum',70),
  ('manutencao_equipamentos','Manutenção Equipamentos',false,'nenhum',80),
  ('fardamento','Fardamento',true,'estoque',90),
  ('frete','Frete',false,'nenhum',100),
  ('reformas_construcoes','Reformas & Construções',false,'nenhum',110),
  ('imobilizado','Imobilizado',true,'patrimonio',120),
  ('material_limpeza','Material de Limpeza',true,'estoque',130),
  ('material_copa','Material Copa',false,'nenhum',140),
  ('material_escritorio','Material de Escritório',true,'estoque',150),
  ('reposicao_estoque','Reposição de Estoque',true,'estoque',160),
  ('departamento_pessoal','Departamento Pessoal',false,'nenhum',170),
  ('recursos_humanos','Recursos Humanos',false,'nenhum',180),
  ('pro_labore','Pro Labore',false,'nenhum',190),
  ('institucional','Institucional',false,'nenhum',200);