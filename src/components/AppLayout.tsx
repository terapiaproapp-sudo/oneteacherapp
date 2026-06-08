import { ReactNode } from "react";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useGreeting } from "@/hooks/use-greeting";
import logo from "@/assets/logo-oneteacher.png";


export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: planLoading, profile } = usePlanGuard();
  const isMobile = useIsMobile();
  const greeting = useGreeting();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Professor";

  // Só mostramos loading se realmente não tivermos nem o usuário nem o perfil ainda
  if (authLoading || (planLoading && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-semibold text-center">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }


  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-16 flex items-center justify-between px-5 border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-50 shrink-0">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1">
              {greeting}
            </p>
            <h1 className="text-base font-bold text-foreground leading-none">
              {firstName}
            </h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
            {firstName.charAt(0)}
          </div>
        </header>
        <main className="flex-1 overflow-auto px-4 pt-4 pb-24">
          {children}
        </main>
        <MobileNav />
      </div>
    );
  }


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-5 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <img src={logo} alt="OneTeacher" className="h-4 opacity-30 object-contain grayscale" />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
