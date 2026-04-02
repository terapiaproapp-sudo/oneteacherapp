import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Início", path: "/dashboard", icon: LayoutDashboard },
  { label: "Alunos", path: "/alunos", icon: Users },
  { label: "Agenda", path: "/agenda", icon: Calendar },
  { label: "Financeiro", path: "/financeiro", icon: DollarSign },
  { label: "Config", path: "/configuracoes", icon: Settings },
];

export function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map((item) => {
          const active = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full py-1 rounded-lg transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
