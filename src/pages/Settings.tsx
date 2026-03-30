import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Bell, Palette } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  const sections = [
    {
      icon: User,
      title: "Minha Conta",
      description: "Informações da sua conta",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Nome</p>
              <p className="text-sm font-medium">{user?.user_metadata?.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">E-mail</p>
              <p className="text-sm font-medium">{user?.email || "—"}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Preferências de lembretes e alertas",
      content: (
        <p className="text-sm text-muted-foreground">Em breve: configure lembretes de aulas e vencimentos.</p>
      ),
    },
    {
      icon: Palette,
      title: "Aparência",
      description: "Tema e personalização visual",
      content: (
        <p className="text-sm text-muted-foreground">Em breve: modo escuro e personalização de cores.</p>
      ),
    },
    {
      icon: Shield,
      title: "Segurança",
      description: "Senha e autenticação",
      content: (
        <p className="text-sm text-muted-foreground">Em breve: alterar senha e autenticação em duas etapas.</p>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="section-subtitle">Gerencie sua conta e preferências.</p>
      </div>

      <div className="space-y-3">
        {sections.map((section, i) => (
          <Card key={i} className="card-premium">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                  <p className="text-[11px] text-muted-foreground">{section.description}</p>
                </div>
              </div>
              {section.content}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <Button variant="outline" onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg">
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
}
