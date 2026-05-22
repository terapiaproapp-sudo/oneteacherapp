import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Shield, Bell, Palette, Save, BellRing, Moon, Sun, Monitor, ExternalLink, CheckCircle2, XCircle, AlertCircle, Loader2, Smartphone, Download, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { subscribeToPush, unsubscribeFromPush, getNotificationSettings, updateNotificationSettings } from "@/lib/notifications";


type ThemeMode = "light" | "dark" | "system";

const PUBLISHED_URL = "https://oneteacherapp.lovable.app";

function getEnvironmentInfo() {
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const hostname = window.location.hostname;
  const isPreview = hostname.includes("id-preview--") || hostname.includes("lovableproject.com");
  const isLovableDev = hostname.includes("lovable.dev");
  const isPublished = hostname === "oneteacherapp.lovable.app" || (!isPreview && !isLovableDev && !isInIframe && !hostname.includes("localhost"));
  const isRestricted = isInIframe || isPreview || isLovableDev;
  return { isInIframe, isPreview, isLovableDev, isPublished, isRestricted };
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");

  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem("ot-theme") as ThemeMode) || "light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
    }
    localStorage.setItem("ot-theme", theme);
  }, [theme]);

  // Notification settings from DB
  const [settings, setSettings] = useState({
    daily_summary: true,
    daily_summary_time: "07:00",
    lesson_reminder: true,
    lesson_reminder_lead_time: "15"
  });

  const env = getEnvironmentInfo();
  const [notifPermission, setNotifPermission] = useState<string>("checking");
  const [notifSupported, setNotifSupported] = useState(true);
  const [swStatus, setSwStatus] = useState<"checking" | "active" | "inactive" | "unsupported">("checking");
  const [diagLogs, setDiagLogs] = useState<{ label: string; status: "ok" | "warn" | "error" }[]>([]);
  const [testingNotif, setTestingNotif] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const dbSettings = await getNotificationSettings(user.id);
    if (dbSettings) setSettings(dbSettings);
  }, [user]);

  useEffect(() => {
    fetchSettings();
    
    if (!("Notification" in window)) { 
      setNotifSupported(false); 
      setNotifPermission("unsupported"); 
    } else {
      setNotifPermission(Notification.permission);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        setSwStatus(regs.length > 0 ? "active" : "inactive");
      }).catch(() => setSwStatus("inactive"));
    } else {
      setSwStatus("unsupported");
    }

    // iOS and PWA detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  }, [fetchSettings]);

  const updateSettings = async (newSettings: any) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await updateNotificationSettings(user.id, updated);
      toast({ title: "Configurações salvas!" });
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const allReady = !env.isRestricted && notifSupported && notifPermission === "granted";

  const requestNotifPermission = async () => {
    if (env.isRestricted) {
      toast({ title: "Ambiente restrito", description: "Abra a versão pública do app para ativar notificações.", variant: "destructive" });
      return;
    }
    if (!notifSupported) {
      toast({ title: "Não suportado", description: "Seu navegador não suporta notificações.", variant: "destructive" });
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      
      if (perm === "granted") {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          await subscribeToPush(regs[0], user!.id);
          setSwStatus("active");
          toast({ title: "Notificações ativadas com sucesso! ✅" });
        } else {
          toast({ title: "Erro", description: "Service Worker não encontrado.", variant: "destructive" });
        }
      } else if (perm === "denied") {
        toast({ title: "Permissão negada", description: "Vá em Configurações do navegador > Notificações e permita este site.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao ativar", description: "Ocorreu um erro ao configurar as notificações.", variant: "destructive" });
    }
  };

  const testNotification = async () => {
    if (!user) return;
    setTestingNotif(true);
    const logs: typeof diagLogs = [];

    try {
      const { data, error } = await supabase.functions.invoke('push-notifications', {
        body: {
          subscription: (await (await navigator.serviceWorker.getRegistrations())[0].pushManager.getSubscription())?.toJSON(),
          title: "OneTeacher 📚",
          body: "Suas notificações estão funcionando! ✅",
          data: { url: "/settings" }
        }
      });

      if (error) throw error;
      logs.push({ label: "Notificação de teste enviada ✓", status: "ok" });
      toast({ title: "Teste enviado!", description: "Você deve receber uma notificação em instantes." });
    } catch (err: any) {
      logs.push({ label: `Erro no teste: ${err?.message || "falha na entrega"}`, status: "error" });
      toast({ title: "Falha no teste", description: err?.message, variant: "destructive" });
    }

    setDiagLogs(logs);
    setTestingNotif(false);
  };

    setTestingNotif(false);
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

  const DiagIcon = ({ s }: { s: "ok" | "warn" | "error" }) =>
    s === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" /> :
    s === "warn" ? <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" /> :
    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;

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

          {/* Environment warning */}
          {env.isRestricted && (
            <div className="p-3 rounded-xl mb-4 bg-warning/8 border border-warning/15">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-warning" />
                <p className="text-xs font-medium text-warning">Ambiente de preview detectado</p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Notificações só funcionam na versão pública do app, aberta diretamente no navegador.
                {env.isInIframe && " (iframe detectado)"}
                {env.isPreview && " (preview)"}
                {env.isLovableDev && " (editor)"}
              </p>
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={() => window.open(PUBLISHED_URL, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir versão pública do app
              </Button>
            </div>
          )}

          {/* Status (only in public env) */}
          {!env.isRestricted && (
            <div className={`p-3 rounded-xl mb-4 ${notifPermission === "granted" ? "bg-accent/8 border border-accent/15" : "bg-warning/8 border border-warning/15"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${notifPermission === "granted" ? "bg-accent" : notifPermission === "denied" ? "bg-destructive" : "bg-warning"}`} />
                <p className={`text-xs font-medium ${notifPermission === "granted" ? "text-accent" : "text-warning"}`}>
                  {notifPermission === "granted" ? "Notificações ativadas ✅" : notifPermission === "denied" ? "Permissão negada pelo navegador" : !notifSupported ? "Navegador não suporta" : "Notificações não ativadas"}
                </p>
              </div>
              {notifPermission === "denied" && (
                <p className="text-[11px] text-muted-foreground mb-2">Acesse Configurações do navegador → Notificações → Permita este site.</p>
              )}
              <div className="flex gap-2 flex-wrap">
                {notifPermission !== "granted" && (
                  <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10" onClick={requestNotifPermission}>
                    <BellRing className="h-3.5 w-3.5" /> {notifPermission === "denied" ? "Tentar novamente" : "Ativar notificações"}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={testNotification} disabled={testingNotif || !allReady}>
                  {testingNotif ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} Testar notificação
                </Button>
              </div>
            </div>
          )}

          {/* Diagnostic logs */}
          {diagLogs.length > 0 && (
            <div className="p-3 rounded-xl mb-4 bg-muted/30 border border-border/40 space-y-1.5">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Diagnóstico</p>
              {diagLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-2">
                  <DiagIcon s={log.status} />
                  <span className="text-xs">{log.label}</span>
                </div>
              ))}
            </div>
          )}

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

          {/* Detailed diagnostic section */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase">Status técnico</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                {env.isRestricted ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle2 className="h-3 w-3 text-accent" />}
                <span>Ambiente: {env.isRestricted ? "restrito" : "público"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {notifSupported ? <CheckCircle2 className="h-3 w-3 text-accent" /> : <XCircle className="h-3 w-3 text-destructive" />}
                <span>API: {notifSupported ? "suportada" : "ausente"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {notifPermission === "granted" ? <CheckCircle2 className="h-3 w-3 text-accent" /> : notifPermission === "denied" ? <XCircle className="h-3 w-3 text-destructive" /> : <AlertCircle className="h-3 w-3 text-warning" />}
                <span>Permissão: {notifPermission}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {swStatus === "active" ? <CheckCircle2 className="h-3 w-3 text-accent" /> : swStatus === "unsupported" ? <XCircle className="h-3 w-3 text-destructive" /> : <AlertCircle className="h-3 w-3 text-warning" />}
                <span>SW: {swStatus === "active" ? "ativo" : swStatus === "inactive" ? "inativo" : swStatus === "unsupported" ? "ausente" : "..."}</span>
              </div>
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
