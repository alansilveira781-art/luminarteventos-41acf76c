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
  Bell,
  CircleUser,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from "lucide-react";
import logo from "@/assets/luminart-logo.png";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = { title: string; url: string; icon: any; group: string; module?: string; adminOnly?: boolean };

const allItems: NavItem[] = [
  { title: "Início", url: "/", icon: LayoutDashboard, group: "Visão geral" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "Estoque", module: "estoque" },
  { title: "Estoque", url: "/estoque", icon: Package, group: "Estoque", module: "estoque" },
  { title: "Solicitantes", url: "/solicitantes", icon: Users, group: "Estoque", module: "estoque" },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, group: "Estoque", module: "estoque" },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine, group: "Estoque", module: "estoque" },
  { title: "Saídas", url: "/saidas", icon: ArrowUpFromLine, group: "Estoque", module: "estoque" },
  { title: "Devoluções", url: "/devolucoes", icon: Undo2, group: "Estoque", module: "estoque" },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, group: "Estoque", module: "estoque" },
  { title: "Administração", url: "/admin", icon: Shield, group: "Administração", adminOnly: true },
];

const groups = ["Visão geral", "Estoque", "Administração"];

const ESTOQUE_ROUTES = ["/dashboard", "/estoque", "/solicitantes", "/fornecedores", "/entradas", "/saidas", "/devolucoes", "/relatorios"];

function isActiveUrl(pathname: string, url: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");
}

function getContext(pathname: string): "home" | "estoque" | "admin" {
  if (pathname.startsWith("/admin")) return "admin";
  if (ESTOQUE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "estoque";
  return "home";
}

function useNavItems(pathname: string) {
  const { isAdmin, hasModule } = useAuth();
  const ctx = getContext(pathname);
  return allItems.filter((i) => {
    // Always show "Início"
    if (i.url === "/") return true;
    if (i.adminOnly) return ctx === "admin" && isAdmin;
    if (i.module === "estoque") return ctx === "estoque" && (isAdmin || hasModule("estoque"));
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
          <img
            src={logo}
            alt="Luminart"
            className={collapsed ? "h-8 w-8 object-contain" : "h-12 w-12 object-contain"}
          />
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
        {groups.map((g) => (
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
                  const active = isActiveUrl(pathname, item.url);
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
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
          const active = isActiveUrl(pathname, item.url);
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
  const current = items.find((i) => isActiveUrl(pathname, i.url));
  const currentTitle = current?.title ?? "Dashboard";

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="h-full px-4 sm:px-6 flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Luminart</span>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="font-medium text-foreground truncate">{currentTitle}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
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
