import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign, ArrowUpRight, ArrowDownRight, Check, CreditCard, TrendingUp, CalendarDays, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Payment {
  id: string; student_id: string; teacher_id: string; amount: number;
  due_date: string; paid_date: string | null; status: string;
  payment_method: string; notes: string; package_id: string | null;
  installment_number: number | null; total_installments: number | null;
  lesson_id?: string | null;
  students?: { name: string };
}

export default function Financial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  useEffect(() => { if (user) loadPayments(); }, [user]);

  const loadPayments = async () => {
    const { data: payRes } = await supabase.from("payments").select("*, students(name)").eq("teacher_id", user!.id).order("due_date");
    const { data: lessonRes } = await supabase.from("lessons").select("id, amount, payment_status, date, students(name)").eq("teacher_id", user!.id).eq("lesson_type", "avulsa");
    
    const standardPayments = (payRes || []).map(p => ({ ...p, type: 'package' }));
    const avulsaPayments = (lessonRes || []).map(l => ({
      id: `lesson-${l.id}`,
      student_id: "", // not used in list
      teacher_id: user!.id,
      amount: l.amount || 0,
      due_date: l.date,
      paid_date: l.payment_status === 'pago' ? l.date : null,
      status: l.payment_status,
      payment_method: "avulsa",
      notes: "Aula Avulsa",
      package_id: null,
      installment_number: null,
      total_installments: null,
      lesson_id: l.id,
      students: l.students,
      type: 'avulsa'
    }));

    setPayments([...standardPayments, ...avulsaPayments].sort((a, b) => b.due_date.localeCompare(a.due_date)));
  };

  const markPaid = async (p: Payment) => {
    if (p.lesson_id) {
      await supabase.from("lessons").update({ payment_status: "pago" }).eq("id", p.lesson_id);
    } else {
      await supabase.from("payments").update({ status: "pago", paid_date: format(new Date(), "yyyy-MM-dd") }).eq("id", p.id);
    }
    toast({ title: "Marcado como pago!" }); loadPayments();
  };

  const undoPaid = async (p: Payment) => {
    if (!confirm("Desfazer este pagamento? O status voltará para 'pendente'.")) return;
    if (p.lesson_id) {
      await supabase.from("lessons").update({ payment_status: "pendente" }).eq("id", p.lesson_id);
    } else {
      await supabase.from("payments").update({ status: "pendente", paid_date: null }).eq("id", p.id);
    }
    toast({ title: "Pagamento desfeito", description: "Status alterado para pendente." }); loadPayments();
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const monthPayments = payments.filter(p => p.due_date >= monthStart && p.due_date <= monthEnd);
  const totalForecast = monthPayments.reduce((s, p) => s + p.amount, 0);
  const totalReceived = monthPayments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const totalPending = monthPayments.filter(p => p.status === "pendente").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === "pendente" && p.due_date < today).reduce((s, p) => s + p.amount, 0);

  // Forecast: next 6 months
  const forecastData = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = addMonths(new Date(), i);
      const ms = format(startOfMonth(d), "yyyy-MM-dd");
      const me = format(endOfMonth(d), "yyyy-MM-dd");
      const mPayments = payments.filter(p => p.due_date >= ms && p.due_date <= me);
      const received = mPayments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0);
      const pending = mPayments.filter(p => p.status === "pendente").reduce((s, p) => s + p.amount, 0);
      months.push({
        name: format(d, "MMM", { locale: ptBR }),
        recebido: received,
        previsto: pending,
        total: received + pending,
      });
    }
    return months;
  }, [payments]);

  // Upcoming payments
  const upcomingPayments = payments.filter(p => p.status === "pendente").sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 20);

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.students?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || p.status === filterStatus ||
      (filterStatus === "atrasado" && p.status === "pendente" && p.due_date < today);
    return matchSearch && matchStatus;
  });

  const isOverdue = (p: Payment) => p.status === "pendente" && p.due_date < today;
  const statusBadgeClass = (p: Payment) => p.status === "pago" ? "bg-accent/10 text-accent border-accent/20" : isOverdue(p) ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-warning/10 text-warning border-warning/20";
  const statusLabel = (p: Payment) => p.status === "pago" ? "Pago" : isOverdue(p) ? "Atrasado" : "Pendente";

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <h1 className="page-title">Financeiro</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="card-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><TrendingUp className="h-4 w-4 text-primary" /></div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">Previsto (mês)</p>
                <p className="text-sm sm:text-lg font-bold text-primary leading-tight">R$ {formatCurrency(totalForecast)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><ArrowUpRight className="h-4 w-4 text-accent" /></div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">Recebido</p>
                <p className="text-sm sm:text-lg font-bold text-accent leading-tight">R$ {formatCurrency(totalReceived)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0"><DollarSign className="h-4 w-4 text-warning" /></div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">Pendente</p>
                <p className="text-sm sm:text-lg font-bold text-warning leading-tight">R$ {formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0"><ArrowDownRight className="h-4 w-4 text-destructive" /></div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">Em atraso</p>
                <p className="text-sm sm:text-lg font-bold text-destructive leading-tight">R$ {formatCurrency(totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card className="card-premium">
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Previsão de Recebimentos</h2>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} width={50} />
                <Tooltip formatter={(v: number) => `R$ ${formatCurrency(v)}`} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming payments */}
      {upcomingPayments.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Próximos Recebimentos</h2>
            <div className="space-y-2">
              {upcomingPayments.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.students?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.due_date} {p.total_installments ? `· ${p.installment_number}/${p.total_installments}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">R$ {formatCurrency(p.amount)}</p>
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border ${statusBadgeClass(p)}`}>{statusLabel(p)}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => markPaid(p)} disabled={isLoading} className="h-8 w-8 p-0 rounded-xl text-accent hover:bg-accent/10">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All payments with filters */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold">Todos os Pagamentos</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10 h-10 rounded-xl bg-card border-border/60" placeholder="Buscar por aluno..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex bg-muted rounded-xl p-1 shrink-0 overflow-x-auto">
            {["todos", "pendente", "pago", "atrasado"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap ${filterStatus === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="card-premium"><CardContent className="py-16 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <Card key={p.id} className="card-premium hover:shadow-md transition-all duration-200">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.students?.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">{p.due_date}</span>
                        {p.payment_method && <span className="text-[10px] text-muted-foreground/60 uppercase">{p.payment_method === 'avulsa' ? 'Aula Avulsa' : p.payment_method}</span>}
                        {p.total_installments && p.total_installments > 1 && (
                          <span className="text-[10px] text-primary font-medium">{p.installment_number}/{p.total_installments}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm sm:text-base font-bold leading-tight">R$ {formatCurrency(p.amount)}</p>
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border mt-0.5 ${statusBadgeClass(p)}`}>{statusLabel(p)}</Badge>
                      </div>
                     {p.status !== "pago" ? (
                        <Button variant="ghost" size="sm" onClick={() => markPaid(p)} disabled={isLoading} className="h-8 w-8 p-0 rounded-xl text-accent hover:bg-accent/10">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => undoPaid(p)} disabled={isLoading} className="h-8 w-8 p-0 rounded-xl text-warning hover:bg-warning/10" title="Desfazer pagamento">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!paymentToUndo} onOpenChange={(open) => !open && setPaymentToUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O status deste pagamento voltará para "pendente".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndoConfirm} className="bg-warning hover:bg-warning/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
