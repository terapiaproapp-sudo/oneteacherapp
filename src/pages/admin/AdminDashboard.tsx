import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, CreditCard, TrendingUp, Clock, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WebhookTestDialog } from "@/components/admin/WebhookTestDialog";


interface Stats {
  total: number;
  active: number;
  inactive: number;
  trial: number;
  paid: number;
  conversionRate: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, trial: 0, paid: 0, conversionRate: 0 });
  const [signupChart, setSignupChart] = useState<{ date: string; count: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (profiles) {
      const active = profiles.filter(p => p.status === "ativo").length;
      const inactive = profiles.filter(p => p.status !== "ativo").length;
      const trial = profiles.filter(p => p.plan === "teste").length;
      const paid = profiles.filter(p => p.plan !== "teste").length;
      setStats({
        total: profiles.length,
        active,
        inactive,
        trial,
        paid,
        conversionRate: profiles.length > 0 ? Math.round((paid / profiles.length) * 100) : 0,
      });

      // Signup chart last 14 days
      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = subDays(new Date(), 13 - i);
        const key = format(d, "yyyy-MM-dd");
        const count = profiles.filter(p => p.created_at?.startsWith(key)).length;
        return { date: format(d, "dd/MM", { locale: ptBR }), count };
      });
      setSignupChart(last14);
    }

    const { data: logs } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentLogs(logs || []);
  };

  const statCards = [
    { label: "Total de Usuários", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Ativos", value: stats.active, icon: UserCheck, color: "text-accent" },
    { label: "Inativos", value: stats.inactive, icon: UserX, color: "text-muted-foreground" },
    { label: "Em Teste", value: stats.trial, icon: Clock, color: "text-warning" },
    { label: "Pagantes", value: stats.paid, icon: CreditCard, color: "text-accent" },
    { label: "Conversão", value: `${stats.conversionRate}%`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <WebhookTestDialog />
      </div>


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={cn("h-4 w-4", s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Novos Cadastros (últimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signupChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade registrada</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.user_id?.slice(0, 8)}...</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), "dd/MM HH:mm") : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
