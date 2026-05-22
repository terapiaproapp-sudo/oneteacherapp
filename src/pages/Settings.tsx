import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Shield, Bell, Palette, Save, BellRing, Moon, Sun, Monitor, ExternalLink, CheckCircle2, XCircle, AlertCircle, Loader2, Smartphone, Clock, Info, ShieldAlert, Terminal, Copy, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { subscribeToPush, getNotificationSettings, updateNotificationSettings, registerServiceWorker } from "@/lib/notifications";

type ThemeMode = "light" | "dark" | "system";

const PUBLISHED_URL = "https://oneteacherapp.lovable.app";

function getEnvironmentInfo() {
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const hostname = window.location.hostname;
  const isPreview = hostname.includes("id-preview--") || hostname.includes("lovableproject.com") || hostname.includes("lovable.app") && hostname.split('.')[0].includes('--');
  const isLovableDev = hostname.includes("lovable.dev");
  const isHttps = window.location.protocol === "https:";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  // Real notifications need HTTPS and no iframe (usually)
  const isRestricted = isInIframe || isPreview || isLovableDev;
  
  return { isInIframe, isPreview, isLovableDev, isHttps, isLocalhost, isRestricted };
}

interface Diagnosis {
  env: ReturnType<typeof getEnvironmentInfo>;
  support: {
    notifications: boolean;
    serviceWorker: boolean;
    pushManager: boolean;
  };
  permission: NotificationPermission | "checking";
  sw: {
    registered: boolean;
    status: string;
    controller: boolean;
  };
  subscription: {
    exists: boolean;
    details?: any;
    error?: string;
  };
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
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis>({
    env,
    support: {
      notifications: "Notification" in window,
      serviceWorker: "serviceWorker" in navigator,
      pushManager: "PushManager" in window
    },
    permission: "checking",
    sw: {
      registered: false,
      status: "checking",
      controller: !!navigator.serviceWorker?.controller
    },
    subscription: {
      exists: false
    }
  });

  const runDiagnosis = useCallback(async () => {
    const updatedDiagnosis: Diagnosis = {
      env: getEnvironmentInfo(),
      support: {
        notifications: "Notification" in window,
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window
      },
      permission: "Notification" in window ? Notification.permission : "default",
      sw: {
        registered: false,
        status: "none",
        controller: !!navigator.serviceWorker?.controller
      },
      subscription: {
        exists: false
      }
    };

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        updatedDiagnosis.sw.registered = true;
        updatedDiagnosis.sw.status = regs[0].active ? "active" : regs[0].installing ? "installing" : "waiting";
        
        try {
          const sub = await regs[0].pushManager.getSubscription();
          updatedDiagnosis.subscription.exists = !!sub;
          if (sub) {
            updatedDiagnosis.subscription.details = sub.toJSON();
          }
        } catch (e: any) {
          updatedDiagnosis.subscription.error = e.message;
        }
      }
    }

    setDiagnosis(updatedDiagnosis);
  }, []);

  useEffect(() => {
    fetchSettings();
    runDiagnosis();

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  }, [fetchSettings, runDiagnosis]);

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
          toast({ title: "Notificações ativadas! ✅" });
        } else {
          toast({ title: "Erro", description: "Service Worker não encontrado. Tente recarregar a página.", variant: "destructive" });
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
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) throw new Error("Service Worker não registrado");
      
      const sub = await regs[0].pushManager.getSubscription();
      if (!sub) throw new Error("Inscrição de push não encontrada");

      const { error } = await supabase.functions.invoke('push-notifications', {
        body: {
          subscription: sub.toJSON(),
          title: "OneTeacher 📚",
          body: "Suas notificações estão funcionando! ✅",
          data: { url: "/settings" }
        }
      });

      if (error) throw error;
      toast({ title: "Teste enviado!", description: "Você deve receber uma notificação em instantes." });
    } catch (err: any) {
      toast({ title: "Falha no teste", description: err?.message || "Erro desconhecido", variant: "destructive" });
    }
    setTestingNotif(false);
  };

  const handleSaveProfile = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Perfil atualizado!" });
    setEditingProfile(false);
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl pb-10">
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
            <div><h2 className="text-sm font-bold">Notificações no Celular</h2><p className="text-[11px] text-muted-foreground">Lembretes e alertas push</p></div>
          </div>

          {isIOS && !isPWA && (
            <div className="p-4 rounded-xl mb-4 bg-primary/10 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Smartphone className="h-5 w-5" />
                <p className="text-sm font-bold">Instalar OneTeacher</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No iPhone, as notificações funcionam melhor com o app instalado. Toque no botão de compartilhamento e selecione <strong>"Adicionar à Tela de Início"</strong>.
              </p>
            </div>
          )}

          {env.isRestricted && (
            <div className="p-3 rounded-xl mb-4 bg-warning/8 border border-warning/15">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-warning" />
                <p className="text-xs font-medium text-warning">Ambiente de preview</p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Notificações reais só funcionam na versão pública do app.
              </p>
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={() => window.open(PUBLISHED_URL, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir versão pública
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Status do dispositivo</p>
                <p className="text-[11px] text-muted-foreground">
                  {notifPermission === "granted" ? "Ativo ✅" : notifPermission === "denied" ? "Bloqueado ❌" : !notifSupported ? "Não suportado" : "Pendente"}
                </p>
              </div>
              <Switch checked={notifPermission === 'granted'} onCheckedChange={requestNotifPermission} />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Resumo diário da agenda</p>
                  <p className="text-[11px] text-muted-foreground">Receba as aulas do dia às {settings.daily_summary_time}</p>
                </div>
                <Switch checked={settings.daily_summary} onCheckedChange={(v) => updateSettings({ daily_summary: v })} />
              </div>

              {settings.daily_summary && (
                <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                  <span className="text-xs text-muted-foreground">Horário do resumo</span>
                  <Input 
                    type="time" 
                    value={settings.daily_summary_time} 
                    onChange={(e) => updateSettings({ daily_summary_time: e.target.value })}
                    className="h-8 w-24 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Lembrete antes da aula</p>
                  <p className="text-[11px] text-muted-foreground">Notificação popup antes de começar</p>
                </div>
                <Switch checked={settings.lesson_reminder} onCheckedChange={(v) => updateSettings({ lesson_reminder: v })} />
              </div>

              {settings.lesson_reminder && (
                <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                  <span className="text-xs text-muted-foreground">Lembrar quanto tempo antes?</span>
                  <Select 
                    value={settings.lesson_reminder_lead_time} 
                    onValueChange={(v) => updateSettings({ lesson_reminder_lead_time: v })}
                  >
                    <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No horário</SelectItem>
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full rounded-xl gap-2 mt-2" 
              onClick={testNotification} 
              disabled={notifPermission !== 'granted' || testingNotif}
            >
              {testingNotif ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
              Enviar notificação de teste
            </Button>
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
            {(["light", "dark", "system"] as ThemeMode[]).map(mode => {
              const icons = { light: Sun, dark: Moon, system: Monitor };
              const labels = { light: "Claro", dark: "Escuro", system: "Sistema" };
              const Icon = icons[mode];
              return (
                <button 
                  key={mode} 
                  onClick={() => setTheme(mode)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === mode ? "border-primary bg-primary/8 text-primary" : "border-border/60 hover:bg-muted/50 text-muted-foreground"}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{labels[mode]}</span>
                </button>
              );
            })}
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
