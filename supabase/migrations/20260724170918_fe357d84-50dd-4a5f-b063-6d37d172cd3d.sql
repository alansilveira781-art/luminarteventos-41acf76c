
-- 1) Reativar módulo RH
UPDATE public.modulos SET ativo = true WHERE slug = 'rh';

-- 2) rh_colaboradores
CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  departamento text,
  funcao text,
  tipo_contratacao text NOT NULL CHECK (tipo_contratacao IN ('diarista','clt','pj')),
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('cpf','cnpj')),
  documento text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_ativo ON public.rh_colaboradores(ativo);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_departamento ON public.rh_colaboradores(departamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_colaboradores TO authenticated;
GRANT ALL ON public.rh_colaboradores TO service_role;

ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_colab_select" ON public.rh_colaboradores
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_colab_insert" ON public.rh_colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_colab_update" ON public.rh_colaboradores
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(),'rh'))
  WITH CHECK (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_colab_delete" ON public.rh_colaboradores
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(),'rh'));

DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated
  BEFORE UPDATE ON public.rh_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) rh_epi_entregas
CREATE TABLE IF NOT EXISTS public.rh_epi_entregas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  tipo_contratacao text NOT NULL,
  epi_descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  motivo text NOT NULL CHECK (motivo IN ('entrega','devolucao_desgaste_normal','devolucao_desgaste_anormal','perda','desligamento')),
  ca text,
  data date NOT NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_epi_colab ON public.rh_epi_entregas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_epi_data ON public.rh_epi_entregas(data);
CREATE INDEX IF NOT EXISTS idx_rh_epi_motivo ON public.rh_epi_entregas(motivo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_epi_entregas TO authenticated;
GRANT ALL ON public.rh_epi_entregas TO service_role;

ALTER TABLE public.rh_epi_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_epi_select" ON public.rh_epi_entregas
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_epi_insert" ON public.rh_epi_entregas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_epi_update" ON public.rh_epi_entregas
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(),'rh'))
  WITH CHECK (public.has_module_access(auth.uid(),'rh'));

CREATE POLICY "rh_epi_delete" ON public.rh_epi_entregas
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(),'rh'));
