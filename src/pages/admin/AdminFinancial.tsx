import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, TrendingDown, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminFinancial() {
  const [stats, setStats] = useState({ paying: 0, revenue: 0, churn: 0 });
  const [planDistribution, setPlanDistribution] = useState<{ plan: string; count: number }[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    if (!profiles) return;

    const paying = profiles.filter(p => p.plan !== "teste" && p.status === "ativo").length;
    const blocked = profiles.filter(p => p.status === "bloqueado" || p.status === "cancelado").length;

    const planPrices: Record<string, number> = {
      mensal: 19.90,
      semestral: 99.90 / 6,
      anual: 179.90 / 12,
    };

    let monthlyRevenue = 0;
    profiles.forEach(p => {
      if (p.plan !== "teste" && p.status === "ativo") {
        monthlyRevenue += planPrices[p.plan] || 0;
      }
    });

    setStats({ paying, revenue: monthlyRevenue, churn: blocked });

    const plans = ["teste", "mensal", "semestral", "anual"];
    setPlanDistribution(plans.map(plan => ({
      plan: plan.charAt(0).toUpperCase() + plan.slice(1),
      count: profiles.filter(p => p.plan === plan).length,
    })));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Financeiro Admin</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagantes</p>
              <p className="text-2xl font-bold text-foreground">{stats.paying}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Mensal Est.</p>
              <p className="text-2xl font-bold text-foreground">R$ {stats.revenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Churn</p>
              <p className="text-2xl font-bold text-foreground">{stats.churn}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" /> Distribuição por Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="plan" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
