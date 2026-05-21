import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Professor";

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-16 flex items-center justify-between px-5 border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-50 shrink-0">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1">
              {getGreeting()}
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
          <header className="h-14 flex items-center border-b border-border/60 bg-card/80 backdrop-blur-sm px-5 shrink-0 sticky top-0 z-10">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
