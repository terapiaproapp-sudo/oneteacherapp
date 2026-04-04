import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Ban, Trash2, Edit, Users, BookOpen, Calendar, CheckCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in: string | null;
  status: string;
  plan: string;
}

interface UserDetail extends Profile {
  studentsCount: number;
  lessonsCount: number;
  lessonsCompleted: number;
  logsCount: number;
  daysSinceLogin: number;
  engagement: string;
  totalRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  studentsList: { name: string; status: string }[];
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setProfiles(data || []);
  };

  const viewDetail = async (profile: Profile) => {
    const [students, lessons, logs, payments] = await Promise.all([
      supabase.from("students").select("id, name, status").eq("teacher_id", profile.id),
      supabase.from("lessons").select("id, status", { count: "exact" }).eq("teacher_id", profile.id),
      supabase.from("activity_logs").select("id", { count: "exact" }).eq("user_id", profile.id),
      supabase.from("payments").select("amount, status, due_date").eq("teacher_id", profile.id),
    ]);

    const lessonsCompleted = lessons.data?.filter(l => l.status === "realizada").length || 0;
    const daysSinceLogin = profile.last_sign_in
      ? Math.floor((Date.now() - new Date(profile.last_sign_in).getTime()) / 86400000)
      : 999;

    let engagement = "baixo";
    if ((logs.count || 0) > 50) engagement = "alto";
    else if ((logs.count || 0) > 10) engagement = "médio";

    const today = new Date().toISOString().slice(0, 10);
    const totalRevenue = (payments.data || []).filter(p => p.status === "pago").reduce((s, p) => s + (p.amount || 0), 0);
    const pendingRevenue = (payments.data || []).filter(p => p.status === "pendente").reduce((s, p) => s + (p.amount || 0), 0);
    const overdueRevenue = (payments.data || []).filter(p => p.status === "pendente" && p.due_date < today).reduce((s, p) => s + (p.amount || 0), 0);

    setSelectedUser({
      ...profile,
      studentsCount: students.data?.length || 0,
      lessonsCount: lessons.count || 0,
      lessonsCompleted,
      logsCount: logs.count || 0,
      daysSinceLogin,
      engagement,
      totalRevenue,
      pendingRevenue,
      overdueRevenue,
      studentsList: (students.data || []).map(s => ({ name: s.name, status: s.status || "ativo" })),
    });
    setDetailOpen(true);
  };

  const updatePlan = async (userId: string, plan: string) => {
    await supabase.from("profiles").update({ plan }).eq("id", userId);
    toast({ title: "Plano atualizado" });
    loadProfiles();
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, plan });
  };

  const toggleStatus = async (userId: string, current: string) => {
    const newStatus = current === "ativo" ? "bloqueado" : "ativo";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);
    toast({ title: `Usuário ${newStatus === "ativo" ? "ativado" : "bloqueado"}` });
    loadProfiles();
  };

  const filtered = profiles.filter(p => {
    const matchSearch = !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === "all" || p.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  const planBadge = (plan: string) => {
    const map: Record<string, string> = {
      teste: "bg-warning/10 text-warning border-warning/20",
      mensal: "bg-primary/10 text-primary border-primary/20",
      semestral: "bg-accent/10 text-accent border-accent/20",
      anual: "bg-accent/10 text-accent border-accent/20",
    };
    return map[plan] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="teste">Teste</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="semestral">Semestral</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Cadastro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={p.status === "ativo" ? "border-accent/30 text-accent" : "border-destructive/30 text-destructive"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={planBadge(p.plan)}>{p.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => viewDetail(p)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(p.id, p.status)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Dados Básicos</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{selectedUser.full_name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-xs">{selectedUser.email}</span></div>
                  <div><span className="text-muted-foreground">Cadastro:</span> <span className="font-medium">{format(new Date(selectedUser.created_at), "dd/MM/yyyy")}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={selectedUser.status === "ativo" ? "border-accent/30 text-accent" : "border-destructive/30 text-destructive"}>{selectedUser.status}</Badge></div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Plano</h3>
                <Select value={selectedUser.plan} onValueChange={(v) => updatePlan(selectedUser.id, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teste">Teste</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Uso do Sistema</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: "Alunos", value: selectedUser.studentsCount },
                    { icon: Calendar, label: "Aulas criadas", value: selectedUser.lessonsCount },
                    { icon: CheckCircle, label: "Aulas realizadas", value: selectedUser.lessonsCompleted },
                    { icon: BookOpen, label: "Registros", value: selectedUser.logsCount },
                  ].map(item => (
                    <div key={item.label} className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-bold text-foreground">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Engajamento</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Dias sem login:</span>{" "}
                    <span className={`font-medium ${selectedUser.daysSinceLogin > 7 ? "text-destructive" : "text-foreground"}`}>
                      {selectedUser.daysSinceLogin > 900 ? "Nunca logou" : `${selectedUser.daysSinceLogin}d`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nível:</span>{" "}
                    <Badge variant="outline" className={
                      selectedUser.engagement === "alto" ? "border-accent/30 text-accent" :
                      selectedUser.engagement === "médio" ? "border-warning/30 text-warning" : "border-destructive/30 text-destructive"
                    }>
                      {selectedUser.engagement}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => toggleStatus(selectedUser.id, selectedUser.status)} className="flex-1">
                  <Ban className="h-4 w-4 mr-1" />
                  {selectedUser.status === "ativo" ? "Bloquear" : "Ativar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
