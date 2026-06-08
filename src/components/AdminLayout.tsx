import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Activity, DollarSign, ArrowLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Atividade", url: "/admin/atividade", icon: Activity },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Voltar ao app
            </Link>
            <button onClick={signOut} className="text-xs text-destructive hover:underline ml-3">Sair</button>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card/60">
        <div className="flex gap-1 px-4 max-w-7xl mx-auto overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                location.pathname === item.url
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">{children}</main>
    </div>
  );
}
