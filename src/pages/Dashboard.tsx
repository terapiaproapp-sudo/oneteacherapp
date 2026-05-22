import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, DollarSign, Clock, AlertTriangle, TrendingUp, ChevronRight, Package } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatHoursDisplay } from "@/lib/formatMinutes";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalStudents: number; activeStudents: number; todayLessons: number;
  monthRevenue: number; pendingPayments: number; totalHoursRemaining: number;
  totalHoursSold: number; overduePayments: number;
}
interface Alert { type: "warning" | "danger" | "info"; title: string; description: string; link?: string; }

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, activeStudents: 0, todayLessons: 0, monthRevenue: 0, pendingPayments: 0, totalHoursRemaining: 0, totalHoursSold: 0, overduePayments: 0 });
  const [recentLessons, setRecentLessons] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (user) loadStats(); }, [user]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const som = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const [studentsRes, todayRes, paymentsRes, packagesRes] = await Promise.all([
        supabase.from("students").select("*").eq("teacher_id", user!.id),
        supabase.from("lessons").select("*, students(name)").eq("teacher_id", user!.id).gte("date", today).lte("date", today + "T23:59:59").order("time"),
        supabase.from("payments").select("*").eq("teacher_id", user!.id),
        supabase.from("packages").select("*").eq("teacher_id", user!.id),
      ]);
      const students = studentsRes.data || [];
      const payments = paymentsRes.data || [];
      const pkgs = packagesRes.data || [];
      const monthPaid = payments.filter((p: any) => p.status === "pago" && p.paid_date && p.paid_date >= som).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const pending = payments.filter((p: any) => p.status === "pendente").reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const overdue = payments.filter((p: any) => p.status === "pendente" && p.due_date < today).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalHoursSold = pkgs.reduce((s: number, p: any) => s + (p.hours_total || 0), 0);
      const totalHoursRemaining = pkgs.filter((p: any) => p.status === "ativo" && students.find(s => s.id === p.student_id)?.enrollment_type === "pacote").reduce((s: number, p: any) => s + ((p.hours_total || 0) - (p.hours_used || 0)), 0);
      const lowHoursPkgs = pkgs.filter((p: any) => p.status === "ativo" && (p.hours_total - p.hours_used) <= 2 && (p.hours_total - p.hours_used) > 0);

      const alertsList: Alert[] = [];
      if (overdue > 0) alertsList.push({ type: "danger", title: "Pagamentos em atraso", description: `R$ ${overdue.toFixed(2)} vencidos`, link: "/financeiro" });
      if (pending > 0) alertsList.push({ type: "warning", title: "Pagamentos pendentes", description: `R$ ${pending.toFixed(2)} a receber`, link: "/financeiro" });
      if (lowHoursPkgs.length > 0) alertsList.push({ type: "info", title: "Pacotes com poucas horas", description: `${lowHoursPkgs.length} pacote(s) com ≤2h restantes`, link: "/alunos" });

      setStats({ totalStudents: students.length, activeStudents: students.filter((s: any) => s.status === "ativo").length, todayLessons: todayRes.data?.length || 0, monthRevenue: monthPaid, pendingPayments: pending, totalHoursRemaining, totalHoursSold, overduePayments: overdue });
      setRecentLessons(todayRes.data || []);
      setAlerts(alertsList);
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const userName = user?.user_metadata?.full_name || "Professor(a)";

  const statCards = [
    { label: "Alunos Ativos", value: stats.activeStudents, icon: Users, color: "text-primary", bg: "bg-primary/8" },
    { label: "Aulas Hoje", value: stats.todayLessons, icon: Calendar, color: "text-accent", bg: "bg-accent/8" },
    { label: "Recebido (mês)", value: `R$ ${stats.monthRevenue.toFixed(0)}`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/8" },
    { label: "A Receber", value: `R$ ${stats.pendingPayments.toFixed(0)}`, icon: DollarSign, color: "text-warning", bg: "bg-warning/8" },
    { label: "Horas Vendidas", value: formatHoursDisplay(stats.totalHoursSold), icon: Package, color: "text-primary", bg: "bg-primary/8" },
    { label: "Horas Restantes", value: formatHoursDisplay(stats.totalHoursRemaining), icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="page-title">Olá, {userName} 👋</h1>
        <p className="section-subtitle mt-0.5">Aqui está o resumo do seu dia.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map(card => (
          <Card key={card.label} className="card-premium hover:shadow-md transition-all duration-200">
            <CardContent className="p-3 sm:p-4">
              <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold tracking-tight">{card.value}</p>
              )}
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 font-semibold uppercase tracking-wide">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="card-premium">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center"><Calendar className="h-4 w-4 text-primary" /></div>
                <h2 className="text-sm font-bold">Aulas de Hoje</h2>
              </div>
              <button onClick={() => navigate("/agenda")} className="text-xs text-primary hover:underline font-medium">Ver agenda</button>
            </div>
            {recentLessons.length === 0 ? (
              <div className="py-8 text-center"><p className="text-sm text-muted-foreground">Nenhuma aula hoje.</p></div>
            ) : (
              <div className="space-y-2">
                {recentLessons.map((lesson: any) => (
                  <div key={lesson.id} onClick={() => navigate("/agenda")} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center shrink-0">
                        <p className="text-sm font-bold text-primary leading-none">{lesson.time}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatHoursDisplay(lesson.duration)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lesson.students?.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{lesson.subject}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-warning/8 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-warning" /></div>
              <h2 className="text-sm font-bold">Alertas</h2>
            </div>
            {alerts.length === 0 ? (
              <div className="py-8 text-center"><p className="text-sm text-muted-foreground">Tudo em ordem! 🎉</p></div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <div key={i} onClick={() => alert.link && navigate(alert.link)}
                    className={`p-3 rounded-xl cursor-pointer transition-colors ${alert.type === "danger" ? "bg-destructive/5 border border-destructive/10 hover:bg-destructive/10" : alert.type === "warning" ? "bg-warning/5 border border-warning/10 hover:bg-warning/10" : "bg-primary/5 border border-primary/10 hover:bg-primary/10"}`}>
                    <p className={`text-sm font-semibold ${alert.type === "danger" ? "text-destructive" : alert.type === "warning" ? "text-warning" : "text-primary"}`}>{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
