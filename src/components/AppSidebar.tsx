import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Calendar, DollarSign, Settings, LogOut, Shield
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
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
import logo from "@/assets/logo-oneteacher.png";

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
  const { signOut, user, role } = useAuth();
  const greeting = useGreeting();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Professor";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarContent>
        {/* Brand & User Greeting Area */}
        <div className="flex flex-col px-4 pt-6 pb-4 border-b border-sidebar-border/50 shrink-0 transition-all duration-300 overflow-hidden bg-sidebar-accent/10">
          {!collapsed ? (
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center gap-2">
                <img src={logo} alt="OneTeacher" className="h-7 object-contain brightness-0 invert" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                  {greeting}
                </p>
                <h2 className="text-xl font-black text-sidebar-foreground leading-tight truncate tracking-tight">
                  {firstName}
                </h2>
                <div className="h-1 w-8 bg-primary rounded-full mt-2" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full gap-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                {firstName.charAt(0)}
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
              {role === "admin" && (
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
