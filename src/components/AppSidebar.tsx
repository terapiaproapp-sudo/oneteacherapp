import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Calendar, DollarSign, Settings, LogOut, Shield
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useGreeting } from "@/hooks/use-greeting";


const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Alunos", url: "/alunos", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const greeting = useGreeting();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Professor";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarContent>
        {/* Brand & User Greeting Area */}
        {/* Premium Greeting Area */}
        <div className="flex flex-col px-6 pt-10 pb-8 border-b border-sidebar-border/50 shrink-0 transition-all duration-300 overflow-hidden">
          {!collapsed ? (
            <div className="animate-fade-in space-y-1">
              <p className="text-[11px] font-bold text-primary uppercase tracking-[0.25em] mb-0.5 opacity-90 drop-shadow-sm">
                {greeting}
              </p>
              <h2 className="text-3xl font-black text-sidebar-foreground leading-none tracking-tight break-words">
                {firstName}
              </h2>
              <div className="pt-4 flex flex-col gap-1">
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                  Sua central de aulas
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full py-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                <span className="text-primary font-black text-lg">{firstName[0]}</span>
              </div>
            </div>
          )}
        </div>


        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/40 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2.5 h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className="hover:bg-sidebar-accent/40 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Shield className="mr-2.5 h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-sm">Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border py-4 bg-sidebar-accent/5">
        {!collapsed && user && (
          <div className="px-4 mb-4">
            <div className="space-y-1">
              <p className="text-[9px] text-sidebar-foreground/50 truncate font-semibold uppercase tracking-wider">Conta ativa</p>
              <p className="text-[10px] text-sidebar-foreground/70 truncate font-medium">{user.email}</p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-sidebar-accent/40 rounded-lg transition-colors">
              <LogOut className="mr-2.5 h-[18px] w-[18px]" />
              {!collapsed && <span className="text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
