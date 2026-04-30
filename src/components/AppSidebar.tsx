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
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Solicitantes", url: "/solicitantes", icon: Users },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine },
  { title: "Saídas", url: "/saidas", icon: ArrowUpFromLine },
  { title: "Devoluções", url: "/devolucoes", icon: Undo2 },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-sidebar-foreground leading-tight">
            Luminart
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Eventos · Estoque
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const active =
            item.url === "/"
              ? pathname === "/"
              : pathname.startsWith(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-[11px] text-muted-foreground">
        v1.0 · Operação interna
      </div>
    </aside>
  );
}
