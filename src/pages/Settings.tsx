import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Shield, Bell, Palette, Save, BellRing, Moon, Sun, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type ThemeMode = "light" | "dark" | "system";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");

  // Theme
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("ot-theme") as ThemeMode) || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") { root.classList.add("dark"); }
    else if (theme === "light") { root.classList.remove("dark"); }
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
    }
    localStorage.setItem("ot-theme", theme);
  }, [theme]);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = localStorage.getItem("ot-notif-prefs");
    return saved ? JSON.parse(saved) : {
      aulasAgendadas: true, aulasDoDia: true, lembrete: true,
      pagamentosPendentes: true, pagamentosAtraso: true,
      vencimentoParcelas: true, pacoteBaixo: true, pacoteAcabando: true,
    };
  });
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem("ot-reminder-time") || "30min");

  const updateNotifPref = (key: string, val: boolean) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    localStorage.setItem("ot-notif-prefs", JSON.stringify(updated));
  };

  const saveReminderTime = (v: string) => {
    setReminderTime(v);
    localStorage.setItem("ot-reminder-time", v);
  };

  const [notifPermission, setNotifPermission] = useState<string>("checking");
  const [notifSupported, setNotifSupported] = useState(true);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotifSupported(false);
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

  const requestNotifPermission = async () => {
    if (!notifSupported) {
      toast({ title: "Notificações não suportadas", description: "Seu navegador não suporta notificações. Use Chrome ou Safari no celular.", variant: "destructive" });
      return;
    }
    if (isInIframe) {
      toast({ title: "Abra no navegador", description: "Notificações não funcionam em iframe. Abra o app diretamente no navegador para ativar.", variant: "destructive" });
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        toast({ title: "Notificações ativadas! ✅", description: "Você receberá lembretes e alertas." });
      } else if (perm === "denied") {
        toast({ title: "Permissão negada", description: "Vá em Configurações do navegador > Notificações e permita este site.", variant: "destructive" });
      } else {
        toast({ title: "Permissão pendente", description: "Clique em 'Permitir' quando o navegador solicitar.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao solicitar permissão", description: "Tente abrir o app diretamente pelo navegador (não em iframe).", variant: "destructive" });
    }
  };

  const testNotification = () => {
    if (!notifSupported) {
      toast({ title: "❌ Não suportado", description: "Seu navegador não suporta notificações push.", variant: "destructive" });
      return;
    }
    if (isInIframe) {
      toast({ title: "❌ Iframe detectado", description: "Abra o app diretamente no navegador para testar notificações.", variant: "destructive" });
      return;
    }
    if (notifPermission !== "granted") {
      toast({ title: "⚠️ Permissão necessária", description: "Ative as notificações primeiro clicando no botão acima.", variant: "destructive" });
      requestNotifPermission();
      return;
    }
    try {
      const notif = new Notification("OneTeacher 📚", {
        body: "Suas notificações estão funcionando corretamente! ✅",
        icon: "/favicon.png",
        tag: "test-notification",
      });
      notif.onclick = () => { window.focus(); notif.close(); };
      toast({ title: "✅ Notificação enviada!", description: "Verifique a barra de notificações do seu dispositivo." });
    } catch (err) {
      toast({ title: "❌ Erro ao enviar", description: "Não foi possível criar a notificação. Tente abrir o app diretamente pelo navegador.", variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Perfil atualizado!" });
    setEditingProfile(false);
  };

  const notifOptions = [
    { key: "aulasAgendadas", label: "Aulas agendadas" },
    { key: "aulasDoDia", label: "Aulas do dia" },
    { key: "lembrete", label: "Lembretes antes da aula" },
    { key: "pagamentosPendentes", label: "Pagamentos pendentes" },
    { key: "pagamentosAtraso", label: "Pagamentos em atraso" },
    { key: "vencimentoParcelas", label: "Vencimento de parcelas" },
    { key: "pacoteBaixo", label: "Pacotes com poucas horas" },
    { key: "pacoteAcabando", label: "Pacotes próximos de acabar" },
  ];

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="section-subtitle">Gerencie sua conta e preferências.</p>
      </div>

      {/* Profile */}
      <Card className="card-premium">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>
            <div><h2 className="text-sm font-bold">Minha Conta</h2><p className="text-[11px] text-muted-foreground">Informações do perfil</p></div>
          </div>
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
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="card-premium">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><Bell className="h-4 w-4 text-primary" /></div>
            <div><h2 className="text-sm font-bold">Notificações</h2><p className="text-[11px] text-muted-foreground">Lembretes e alertas</p></div>
          </div>

          {/* Status display */}
          <div className={`p-3 rounded-xl mb-4 ${notifPermission === "granted" ? "bg-accent/8 border border-accent/15" : "bg-warning/8 border border-warning/15"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${notifPermission === "granted" ? "bg-accent" : notifPermission === "denied" ? "bg-destructive" : "bg-warning"}`} />
              <p className={`text-xs font-medium ${notifPermission === "granted" ? "text-accent" : "text-warning"}`}>
                {notifPermission === "granted" ? "Notificações ativadas ✅" : notifPermission === "denied" ? "Permissão negada" : notifPermission === "unsupported" ? "Navegador não suporta" : isInIframe ? "Abra no navegador para ativar" : "Notificações não ativadas"}
              </p>
            </div>
            {notifPermission !== "granted" && (
              <p className="text-[11px] text-muted-foreground mb-2">
                {notifPermission === "denied"
                  ? "Acesse Configurações do navegador > Notificações e permita este site."
                  : isInIframe
                  ? "Notificações não funcionam dentro de iframes. Abra o app diretamente no navegador."
                  : "Clique abaixo para permitir notificações push."}
              </p>
            )}
            <div className="flex gap-2">
              {notifPermission !== "granted" && (
                <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10" onClick={requestNotifPermission}>
                  <BellRing className="h-3.5 w-3.5" /> {notifPermission === "denied" ? "Tentar novamente" : "Ativar notificações"}
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={testNotification}>
                <BellRing className="h-3.5 w-3.5" /> Testar notificação
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {notifOptions.map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <span className="text-sm">{opt.label}</span>
                <Switch checked={notifPrefs[opt.key]} onCheckedChange={v => updateNotifPref(opt.key, v)} />
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Antecedência do lembrete</span>
              <Select value={reminderTime} onValueChange={saveReminderTime}>
                <SelectTrigger className="h-9 w-40 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No horário</SelectItem>
                  <SelectItem value="15min">15 minutos antes</SelectItem>
                  <SelectItem value="30min">30 minutos antes</SelectItem>
                  <SelectItem value="1h">1 hora antes</SelectItem>
                  <SelectItem value="2h">2 horas antes</SelectItem>
                  <SelectItem value="1d">1 dia antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="card-premium">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><Palette className="h-4 w-4 text-primary" /></div>
            <div><h2 className="text-sm font-bold">Aparência</h2><p className="text-[11px] text-muted-foreground">Tema e personalização</p></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "light" as ThemeMode, icon: Sun, label: "Claro" },
              { value: "dark" as ThemeMode, icon: Moon, label: "Escuro" },
              { value: "system" as ThemeMode, icon: Monitor, label: "Sistema" },
            ]).map(opt => (
              <button key={opt.value} onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === opt.value ? "border-primary bg-primary/8 text-primary" : "border-border/60 hover:bg-muted/50 text-muted-foreground"}`}>
                <opt.icon className="h-5 w-5" />
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="card-premium">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center"><Shield className="h-4 w-4 text-primary" /></div>
            <div><h2 className="text-sm font-bold">Segurança</h2><p className="text-[11px] text-muted-foreground">Senha e autenticação</p></div>
          </div>
          <p className="text-sm text-muted-foreground">Em breve: alterar senha e autenticação em duas etapas.</p>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-xl">
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
}
