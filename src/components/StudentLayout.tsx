import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-16 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 sm:px-6 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src="/src/assets/logo-oneteacher.png" alt="OneTeacher" className="h-8 object-contain" />
          <span className="text-sm font-semibold text-muted-foreground hidden sm:inline">Área do Aluno</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
