import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  BarChart3,
  Menu,
  X,
  
  CircleUser,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  ShoppingCart,
  KanbanSquare,
  PackageCheck,
  Wallet,
  Sun,
  Moon,
  Briefcase,
  Users2,
  ClipboardCheck,
  FileText,
  Link2,
  BookOpen,
  Calculator,
  Settings,
  Search,
  Scale,
  UserPlus,
  Boxes,
  FileSignature,

} from "lucide-react";
import logo from "@/assets/luminart-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NotificationBell } from "@/components/NotificationBell";

type NavItem = { title: string; url: string; icon: any; group: string; module?: string; adminOnly?: boolean; moduleAdminOnly?: string };

const allItems: NavItem[] = [
  { title: "Início", url: "/", icon: LayoutDashboard, group: "Visão geral" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Estoque", module: "estoque" },
  { title: "Estoque", url: "/estoque", icon: Package, group: "Estoque", module: "estoque" },
  { title: "Solicitantes", url: "/solicitantes", icon: Users, group: "Estoque", module: "estoque" },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, group: "Estoque", module: "estoque" },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine, group: "Estoque", module: "estoque" },
  { title: "Saídas", url: "/saidas", icon: ArrowUpFromLine, group: "Estoque", module: "estoque" },
  { title: "Devoluções", url: "/devolucoes", icon: Undo2, group: "Estoque", module: "estoque" },
  { title: "A receber", url: "/estoque/a-receber", icon: PackageCheck, group: "Estoque", module: "estoque" },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, group: "Estoque", module: "estoque" },
  { title: "Dashboard", url: "/compras/dashboard", icon: BarChart3, group: "Compras", module: "compras" },
  { title: "Quadro de Compras", url: "/compras", icon: KanbanSquare, group: "Compras", module: "compras" },
  { title: "Configurações", url: "/compras/configuracoes", icon: Settings, group: "Compras", module: "compras", moduleAdminOnly: "compras" },
  { title: "Dashboard", url: "/financeiro/dashboard", icon: BarChart3, group: "Despesas", module: "financeiro" },
  { title: "Quadro de Demandas", url: "/financeiro", icon: KanbanSquare, group: "Despesas", module: "financeiro" },
  { title: "Rotinas", url: "/financeiro/rotinas", icon: ClipboardCheck, group: "Despesas", module: "financeiro" },
  { title: "Conta Azul", url: "/financeiro/conta-azul", icon: Link2, group: "Despesas", module: "financeiro" },
  { title: "Quadro de Vendas", url: "/comercial", icon: KanbanSquare, group: "Comercial", module: "comercial" },
  { title: "Propostas", url: "/comercial/propostas", icon: FileText, group: "Comercial", module: "comercial" },
  { title: "Validações", url: "/comercial/validacoes", icon: ClipboardCheck, group: "Comercial", module: "comercial", moduleAdminOnly: "comercial" },
  { title: "Clientes", url: "/comercial/clientes", icon: Users2, group: "Comercial", module: "comercial" },
  { title: "Catálogo", url: "/comercial/catalogo", icon: BookOpen, group: "Comercial", module: "comercial" },
  { title: "Configurações", url: "/comercial/configuracoes", icon: Settings, group: "Comercial", module: "comercial", moduleAdminOnly: "comercial" },
  { title: "Dashboard", url: "/contabil", icon: BarChart3, group: "Contábil", module: "contabil" },
  { title: "Notas fiscais", url: "/contabil/notas", icon: FileText, group: "Contábil", module: "contabil" },
  { title: "Recebimentos", url: "/contabil/recebimentos", icon: FileText, group: "Contábil", module: "contabil" },
  { title: "Apurações de impostos", url: "/contabil/apuracoes", icon: Search, group: "Contábil", module: "contabil" },
  { title: "Configuração", url: "/contabil/configuracao", icon: Settings, group: "Contábil", module: "contabil" },
  { title: "Contratos", url: "/juridico", icon: Scale, group: "Jurídico", module: "juridico" },
  { title: "Modelos", url: "/juridico/modelos", icon: FileSignature, group: "Jurídico", module: "juridico" },
  { title: "Dashboard", url: "/patrimonio/dashboard", icon: BarChart3, group: "Patrimônio", module: "patrimonio" },
  { title: "Inventário", url: "/patrimonio", icon: Boxes, group: "Patrimônio", module: "patrimonio" },
  { title: "Entradas", url: "/patrimonio/entradas", icon: ArrowDownToLine, group: "Patrimônio", module: "patrimonio" },
  { title: "Saídas", url: "/patrimonio/saidas", icon: ArrowUpFromLine, group: "Patrimônio", module: "patrimonio" },
  { title: "Devoluções", url: "/patrimonio/devolucoes", icon: Undo2, group: "Patrimônio", module: "patrimonio" },
  { title: "Recrutamento", url: "/rh", icon: UserPlus, group: "Recursos Humanos", module: "rh" },
  { title: "Administração", url: "/admin", icon: Shield, group: "Administração", adminOnly: true },
];

const groups = ["Visão geral", "Estoque", "Compras", "Despesas", "Comercial", "Contábil", "Jurídico", "Patrimônio", "Recursos Humanos", "Administração"];


const ESTOQUE_ROUTES = ["/dashboard", "/estoque", "/solicitantes", "/fornecedores", "/entradas", "/saidas", "/devolucoes", "/relatorios"];
const COMPRAS_ROUTES = ["/compras"];
const FINANCEIRO_ROUTES = ["/financeiro"];
const COMERCIAL_ROUTES = ["/comercial"];
const CONTABIL_ROUTES = ["/contabil"];
const JURIDICO_ROUTES = ["/juridico"];
const PATRIMONIO_ROUTES = ["/patrimonio"];
const RH_ROUTES = ["/rh"];

function isActiveUrl(pathname: string, url: string, allUrls: string[] = []) {
  if (url === "/") return pathname === "/";
  if (pathname === url) return true;
  // Se houver outra URL mais específica que casa, este item NÃO está ativo
  const moreSpecific = allUrls.some(
    (u) => u !== url && u.startsWith(url + "/") && (pathname === u || pathname.startsWith(u + "/")),
  );
  if (moreSpecific) return false;
  return pathname.startsWith(url + "/");
}

function getContext(pathname: string): "home" | "estoque" | "compras" | "financeiro" | "comercial" | "contabil" | "juridico" | "patrimonio" | "rh" | "admin" {
  if (pathname.startsWith("/admin")) return "admin";
  if (RH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "rh";
  if (PATRIMONIO_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "patrimonio";
  if (JURIDICO_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "juridico";
  if (CONTABIL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "contabil";
  if (COMERCIAL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "comercial";
  if (FINANCEIRO_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "financeiro";
  if (COMPRAS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "compras";
  if (ESTOQUE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "estoque";
  return "home";
}

function useNavItems(pathname: string) {
  const { isAdmin, hasModule, modulos } = useAuth();
  const ctx = getContext(pathname);
  return allItems.filter((i) => {
    if (i.url === "/") return true;
    if (i.adminOnly) return ctx === "admin" && isAdmin;
    if (i.moduleAdminOnly) {
      return ctx === i.moduleAdminOnly && (isAdmin || modulos.some((m) => m.slug === i.moduleAdminOnly && m.is_admin));
    }
    if (i.module === "estoque") return ctx === "estoque" && (isAdmin || hasModule("estoque"));
    if (i.module === "compras") return ctx === "compras" && (isAdmin || hasModule("compras"));
    if (i.module === "financeiro") return ctx === "financeiro" && (isAdmin || hasModule("financeiro"));
    if (i.module === "comercial") return ctx === "comercial" && (isAdmin || hasModule("comercial"));
    if (i.module === "contabil") return ctx === "contabil" && (isAdmin || hasModule("contabil"));
    if (i.module === "juridico") return ctx === "juridico" && (isAdmin || hasModule("juridico"));
    if (i.module === "patrimonio") return ctx === "patrimonio" && (isAdmin || hasModule("patrimonio"));
    if (i.module === "rh") return ctx === "rh" && (isAdmin || hasModule("rh"));
    return true;
  });
}


function SidebarBody({
  pathname,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const items = useNavItems(pathname);
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-20 items-center border-b border-sidebar-border ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <Link to="/" onClick={onNavigate} className="flex items-center gap-3 min-w-0">
          <div
            className={`flex items-center justify-center rounded-full bg-black shrink-0 ${
              collapsed ? "h-9 w-9" : "h-12 w-12"
            }`}
          >
            <img
              src={logo}
              alt="Luminart"
              className={collapsed ? "h-7 w-7 object-contain" : "h-10 w-10 object-contain"}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">
                LUMINART
              </div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Cenografia para eventos
              </div>
            </div>
          )}
        </Link>
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Recolher menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex mx-auto mt-3 h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Expandir menu"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? "px-2" : "px-3"}`}>
        {groups.filter((g) => items.some((i) => i.group === g)).map((g) => (
          <div key={g}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {g}
              </div>
            )}
            <div className="space-y-0.5">
              {items
                .filter((i) => i.group === g)
                .map((item) => {
                  const active = isActiveUrl(pathname, item.url, items.map((i) => i.url));
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      preload="intent"
                      onClick={onNavigate}
                      title={collapsed ? item.title : undefined}
                      className={`group relative flex items-center gap-3 rounded-md text-sm font-medium transition-all ${
                        collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
                      } ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                      )}
                      <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>


      <div className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <button
            type="button"
            onClick={() => signOut()}
            title="Sair"
            className="mx-auto h-9 w-9 rounded-md flex items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <CircleUser className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-sidebar-foreground truncate">
                  {user?.user_metadata?.full_name ?? user?.email ?? "Usuário"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MobileRail({ pathname, onOpenMenu }: { pathname: string; onOpenMenu: () => void }) {
  const items = useNavItems(pathname);
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col items-center border-r border-sidebar-border bg-sidebar lg:hidden sm:w-20">
      <button
        type="button"
        onClick={onOpenMenu}
        className="mt-3 flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir navegação"
      >
        <Menu className="h-5 w-5" />
      </button>
      <nav className="mt-5 flex flex-1 flex-col items-center gap-2">
        {items.map((item) => {
          const active = isActiveUrl(pathname, item.url, items.map((i) => i.url));
          return (
            <Link
              key={item.url}
              to={item.url}
              title={item.title}
              aria-label={item.title}
              className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);




  return (
    <>
      <MobileRail pathname={pathname} onOpenMenu={() => setOpen(true)} />

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <SidebarBody
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[20rem] max-w-[86vw] bg-sidebar border-r border-sidebar-border shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring z-10"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

    </>
  );
}

export function AppTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useNavItems(pathname);
  const current = items.find((i) => isActiveUrl(pathname, i.url, items.map((x) => x.url)));
  const currentTitle = current?.title ?? "Dashboard";

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-14 px-4 sm:px-6 flex items-center gap-3">

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Luminart</span>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="font-medium text-foreground truncate">{currentTitle}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Online
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label="Alternar tema"
      className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
