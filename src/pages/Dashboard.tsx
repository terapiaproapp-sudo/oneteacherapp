import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, DollarSign, Clock, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";

interface Stats {
  totalStudents: number;
  activeStudents: number;
  todayLessons: number;
  monthRevenue: number;
  pendingPayments: number;
  totalHoursRemaining: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, activeStudents: 0, todayLessons: 0,
    monthRevenue: 0, pendingPayments: 0, totalHoursRemaining: 0,
  });
  const [recentLessons, setRecentLessons] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  const loadStats = async () => {
    const { data: students } = await supabase
      .from("students").select("*").eq("teacher_id", user!.id);
    const active = students?.filter(s => s.status === "ativo") || [];
    const totalHours = active.reduce((sum, s) => sum + (s.hours_remaining || 0), 0);

    const today = new Date().toISOString().split("T")[0];
    const { data: todayData } = await supabase
      .from("lessons").select("*, students(name)")
      .eq("teacher_id", user!.id)
      .gte("date", today).lte("date", today + "T23:59:59");

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: payments } = await supabase
      .from("payments").select("*").eq("teacher_id", user!.id);

    const monthPaid = payments?.filter(p => p.status === "pago" && p.paid_date >= startOfMonth.toISOString().split("T")[0])
      .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const pending = payments?.filter(p => p.status === "pendente")
      .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    setStats({
      totalStudents: students?.length || 0,
      activeStudents: active.length,
      todayLessons: todayData?.length || 0,
      monthRevenue: monthPaid,
      pendingPayments: pending,
      totalHoursRemaining: totalHours,
    });
    setRecentLessons(todayData || []);
  };

  const userName = user?.user_metadata?.full_name || "Professor(a)";

  const statCards = [
    { label: "Alunos Ativos", value: stats.activeStudents, icon: Users, color: "text-primary", bg: "bg-primary/8" },
    { label: "Aulas Hoje", value: stats.todayLessons, icon: Calendar, color: "text-accent", bg: "bg-accent/8" },
    { label: "Recebido", value: `R$ ${stats.monthRevenue.toFixed(0)}`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/8" },
    { label: "A Receber", value: `R$ ${stats.pendingPayments.toFixed(0)}`, icon: DollarSign, color: "text-warning", bg: "bg-warning/8" },
    { label: "Horas Restantes", value: stats.totalHoursRemaining, icon: Clock, color: "text-primary", bg: "bg-primary/8" },
    { label: "Total Alunos", value: stats.totalStudents, icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Greeting */}
      <div>
        <h1 className="page-title">Olá, {userName} 👋</h1>
        <p className="section-subtitle mt-0.5">Aqui está o resumo do seu dia.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className="card-premium hover:shadow-md transition-all duration-200 group">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="stat-value">{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's Lessons */}
        <Card className="card-premium">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <h2 className="section-title">Aulas de Hoje</h2>
              </div>
              <span className="text-xs text-muted-foreground font-medium">{recentLessons.length} aula(s)</span>
            </div>
            {recentLessons.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma aula agendada para hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentLessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group/item cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center shrink-0">
                        <p className="text-sm font-bold text-primary leading-none">{lesson.time}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{lesson.duration}h</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lesson.students?.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{lesson.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        lesson.status === "concluida" ? "bg-accent/10 text-accent" :
                        lesson.status === "cancelada" ? "bg-destructive/10 text-destructive" :
                        "bg-primary/10 text-primary"
                      }`}>{lesson.status}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="card-premium">
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-warning/8 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <h2 className="section-title">Alertas</h2>
            </div>
            <div className="space-y-2">
              {stats.pendingPayments > 0 && (
                <div className="p-3 rounded-lg bg-warning/6 border border-warning/10">
                  <p className="text-sm font-medium text-warning">Pagamentos pendentes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">R$ {stats.pendingPayments.toFixed(2)} a receber</p>
                </div>
              )}
              {stats.totalHoursRemaining <= 5 && stats.activeStudents > 0 && (
                <div className="p-3 rounded-lg bg-destructive/6 border border-destructive/10">
                  <p className="text-sm font-medium text-destructive">Pacotes com poucas horas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Alunos com poucas horas restantes</p>
                </div>
              )}
              {stats.pendingPayments === 0 && stats.totalHoursRemaining > 5 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">Tudo em ordem! 🎉</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
