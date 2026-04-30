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
  Sparkles,
  Menu,
  X,
  Search,
  Bell,
  CircleUser,
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, group: "Visão geral" },
  { title: "Estoque", url: "/estoque", icon: Package, group: "Cadastros" },
  { title: "Solicitantes", url: "/solicitantes", icon: Users, group: "Cadastros" },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, group: "Cadastros" },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine, group: "Movimentações" },
  { title: "Saídas", url: "/saidas", icon: ArrowUpFromLine, group: "Movimentações" },
  { title: "Devoluções", url: "/devolucoes", icon: Undo2, group: "Movimentações" },
];

const groups = ["Visão geral", "Cadastros", "Movimentações"];

function isActiveUrl(pathname: string, url: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");
}

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">
            Luminart Eventos
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Controle de Estoque
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              {g}
            </div>
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
                      className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                      )}
                      <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <CircleUser className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-sidebar-foreground truncate">Operador</div>
            <div className="text-[10px] text-muted-foreground truncate">operacao@luminart</div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground/70 text-center">
          v1.0 · Operação interna
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const current = items.find((i) => isActiveUrl(pathname, i.url));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarBody pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Topbar (sempre visível) */}
      <TopBar onOpenMenu={() => setOpen(true)} currentTitle={current?.title ?? "Dashboard"} />
    </>
  );
}

function TopBar({ onOpenMenu, currentTitle }: { onOpenMenu: () => void; currentTitle: string }) {
  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="h-full px-4 sm:px-6 flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="lg:hidden h-9 w-9 rounded-md flex items-center justify-center text-foreground hover:bg-muted"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:inline">Luminart</span>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="font-medium text-foreground truncate">{currentTitle}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground w-64">
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Buscar item, fornecedor...</span>
          </div>
          <button
            className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground relative"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-warning" />
          </button>
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
