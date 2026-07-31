import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarEventos from "./tools/listar-eventos";
import listarCompras from "./tools/listar-compras";
import listarDespesas from "./tools/listar-despesas";
import consultarEstoque from "./tools/consultar-estoque";
import listarMeusPedidos from "./tools/listar-meus-pedidos";
import resumoFinanceiro from "./tools/resumo-financeiro";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "grupo-luminart",
  title: "Grupo Luminart",
  version: "0.1.0",
  instructions:
    "Ferramentas do sistema interno do Grupo Luminart (eventos, compras, despesas, estoque e financeiro). Todas as consultas respeitam as permissões do usuário conectado. Datas usam o formato AAAA-MM-DD e valores estão em reais.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarEventos,
    listarCompras,
    listarDespesas,
    consultarEstoque,
    listarMeusPedidos,
    resumoFinanceiro,
  ],
});
