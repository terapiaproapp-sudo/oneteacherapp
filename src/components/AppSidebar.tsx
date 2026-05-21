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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Professor";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* User Greeting Area */}
        <div className="flex flex-col justify-center px-4 h-24 border-b border-sidebar-border shrink-0 transition-all duration-300 overflow-hidden">
          {!collapsed ? (
            <div className="animate-fade-in">
              <p className="text-xs font-medium text-sidebar-foreground/60 mb-0.5">
                {getGreeting()},
              </p>
              <h2 className="text-lg font-bold text-sidebar-foreground leading-tight truncate">
                {firstName}
              </h2>
              <p className="text-[10px] text-primary/80 mt-1 font-medium bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                Seu painel de aulas
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
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

      <SidebarFooter className="border-t border-sidebar-border py-4">
        {!collapsed && (
          <div className="px-4 mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <img src={logo} alt="OneTeacher" className="h-4 object-contain brightness-0 invert opacity-30" />
            </div>
            {user && (
              <p className="text-[10px] text-sidebar-foreground/40 truncate font-medium">{user.email}</p>
            )}
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
