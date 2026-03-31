import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Shield, Bell, Palette, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");

  const handleSaveProfile = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Perfil atualizado!" });
    setEditingProfile(false);
  };

  const sections = [
    {
      icon: User, title: "Minha Conta", description: "Informações do perfil",
      content: (
        <div className="space-y-4">
          {editingProfile ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nome completo</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-10 rounded-xl" placeholder="Seu nome" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">E-mail</Label>
                <Input value={user?.email || ""} disabled className="h-10 rounded-xl bg-muted/50" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="rounded-xl gap-1" onClick={handleSaveProfile}><Save className="h-3.5 w-3.5" /> Salvar</Button>
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditingProfile(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nome</p>
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">E-mail</p>
                  <p className="text-sm font-medium">{user?.email || "—"}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1" onClick={() => setEditingProfile(true)}>
                <User className="h-3.5 w-3.5" /> Editar perfil
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      icon: Bell, title: "Notificações", description: "Preferências de lembretes e alertas",
      content: <p className="text-sm text-muted-foreground">Em breve: configure lembretes de aulas e vencimentos.</p>,
    },
    {
      icon: Palette, title: "Aparência", description: "Tema e personalização visual",
      content: <p className="text-sm text-muted-foreground">Em breve: modo escuro e personalização de cores.</p>,
    },
    {
      icon: Shield, title: "Segurança", description: "Senha e autenticação",
      content: <p className="text-sm text-muted-foreground">Em breve: alterar senha e autenticação em duas etapas.</p>,
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
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">{section.title}</h2>
                  <p className="text-[11px] text-muted-foreground">{section.description}</p>
                </div>
              </div>
              {section.content}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <Button variant="outline" onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-xl">
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
}
