import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, Clock, AlertTriangle, TrendingUp } from "lucide-react";

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
      .from("students")
      .select("*")
      .eq("teacher_id", user!.id);

    const active = students?.filter(s => s.status === "ativo") || [];
    const totalHours = active.reduce((sum, s) => sum + (s.hours_remaining || 0), 0);

    const today = new Date().toISOString().split("T")[0];
    const { data: todayData } = await supabase
      .from("lessons")
      .select("*, students(name)")
      .eq("teacher_id", user!.id)
      .gte("date", today)
      .lte("date", today + "T23:59:59");

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("teacher_id", user!.id);

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

  const statCards = [
    { label: "Alunos Ativos", value: stats.activeStudents, icon: Users, color: "text-primary" },
    { label: "Aulas Hoje", value: stats.todayLessons, icon: Calendar, color: "text-success" },
    { label: "Recebido no Mês", value: `R$ ${stats.monthRevenue.toFixed(2)}`, icon: TrendingUp, color: "text-success" },
    { label: "A Receber", value: `R$ ${stats.pendingPayments.toFixed(2)}`, icon: DollarSign, color: "text-warning" },
    { label: "Horas Restantes", value: stats.totalHoursRemaining, icon: Clock, color: "text-info" },
    { label: "Total Alunos", value: stats.totalStudents, icon: Users, color: "text-muted-foreground" },
  ];

  const userName = user?.user_metadata?.full_name || "Professor(a)";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Olá, {userName}! 👋</h1>
        <p className="text-muted-foreground">Aqui está o resumo do seu dia.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Aulas de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLessons.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma aula agendada para hoje.</p>
            ) : (
              <div className="space-y-3">
                {recentLessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{lesson.students?.name}</p>
                      <p className="text-xs text-muted-foreground">{lesson.subject} • {lesson.time}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      lesson.status === "concluida" ? "bg-success/10 text-success" :
                      lesson.status === "cancelada" ? "bg-destructive/10 text-destructive" :
                      "bg-primary/10 text-primary"
                    }`}>{lesson.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.pendingPayments > 0 && (
                <div className="p-3 bg-warning/10 rounded-lg">
                  <p className="text-sm font-medium text-warning">Pagamentos pendentes</p>
                  <p className="text-xs text-muted-foreground">R$ {stats.pendingPayments.toFixed(2)} em parcelas a receber</p>
                </div>
              )}
              {stats.totalHoursRemaining <= 5 && stats.activeStudents > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Pacotes com poucas horas</p>
                  <p className="text-xs text-muted-foreground">Alguns alunos estão com poucas horas restantes</p>
                </div>
              )}
              {stats.pendingPayments === 0 && stats.totalHoursRemaining > 5 && (
                <p className="text-muted-foreground text-sm">Tudo em ordem! 🎉</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
