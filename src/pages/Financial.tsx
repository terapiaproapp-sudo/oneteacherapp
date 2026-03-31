import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, DollarSign, ArrowUpRight, ArrowDownRight, Check, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Payment {
  id: string; student_id: string; teacher_id: string; amount: number;
  due_date: string; paid_date: string | null; status: string;
  payment_method: string; notes: string; package_id: string | null;
  installment_number: number | null; total_installments: number | null;
  students?: { name: string };
}
interface Student { id: string; name: string; }
interface StudentPackage { id: string; student_id: string; name: string; total_value: number; }

export default function Financial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<StudentPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [form, setForm] = useState({
    student_id: "", amount: 0, due_date: format(new Date(), "yyyy-MM-dd"),
    paid_date: "", status: "pendente", payment_method: "", notes: "",
    package_id: "", installment_number: 0, total_installments: 0,
  });
  const [installmentMode, setInstallmentMode] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [installmentTotal, setInstallmentTotal] = useState(0);

  useEffect(() => { if (user) { loadPayments(); loadStudents(); loadPackages(); } }, [user]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("id,name").eq("teacher_id", user!.id);
    setStudents(data || []);
  };

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("id,student_id,name,total_value").eq("teacher_id", user!.id);
    setPackages(data || []);
  };

  const loadPayments = async () => {
    const { data } = await supabase.from("payments").select("*, students(name)")
      .eq("teacher_id", user!.id).order("due_date", { ascending: false });
    setPayments(data || []);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.amount) { toast({ title: "Preencha aluno e valor", variant: "destructive" }); return; }
    const payload = {
      student_id: form.student_id, amount: form.amount, due_date: form.due_date,
      paid_date: form.paid_date || null, status: form.status, payment_method: form.payment_method,
      notes: form.notes, teacher_id: user!.id, package_id: form.package_id || null,
      installment_number: form.installment_number || null, total_installments: form.total_installments || null,
    };
    if (editing) {
      await supabase.from("payments").update(payload).eq("id", editing.id);
      toast({ title: "Pagamento atualizado!" });
    } else {
      await supabase.from("payments").insert(payload);
      toast({ title: "Pagamento registrado!" });
    }
    setDialogOpen(false); setEditing(null); loadPayments();
  };

  const handleCreateInstallments = async () => {
    if (!form.student_id || installmentTotal <= 0 || installmentCount < 2) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    const perInstallment = Math.round((installmentTotal / installmentCount) * 100) / 100;
    const payloads = [];
    for (let i = 1; i <= installmentCount; i++) {
      const dueDate = new Date(form.due_date);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      payloads.push({
        student_id: form.student_id, amount: perInstallment, due_date: format(dueDate, "yyyy-MM-dd"),
        paid_date: null, status: "pendente", payment_method: form.payment_method,
        notes: `Parcela ${i}/${installmentCount}`, teacher_id: user!.id,
        package_id: form.package_id || null, installment_number: i, total_installments: installmentCount,
      });
    }
    const { error } = await supabase.from("payments").insert(payloads);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${installmentCount} parcelas criadas!` });
    setDialogOpen(false); setInstallmentMode(false); loadPayments();
  };

  const markPaid = async (p: Payment) => {
    await supabase.from("payments").update({ status: "pago", paid_date: format(new Date(), "yyyy-MM-dd") }).eq("id", p.id);
    toast({ title: "Marcado como pago!" }); loadPayments();
  };

  const openEdit = (p: Payment) => {
    setEditing(p); setInstallmentMode(false);
    setForm({
      student_id: p.student_id, amount: p.amount, due_date: p.due_date,
      paid_date: p.paid_date || "", status: p.status, payment_method: p.payment_method || "",
      notes: p.notes || "", package_id: p.package_id || "",
      installment_number: p.installment_number || 0, total_installments: p.total_installments || 0,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null); setInstallmentMode(false);
    setForm({ student_id: "", amount: 0, due_date: format(new Date(), "yyyy-MM-dd"), paid_date: "", status: "pendente", payment_method: "", notes: "", package_id: "", installment_number: 0, total_installments: 0 });
    setInstallmentTotal(0); setInstallmentCount(2);
    setDialogOpen(true);
  };

  const getStudentPackages = (studentId: string) => packages.filter(p => p.student_id === studentId);

  const totalReceived = payments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pendente").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === "pendente" && p.due_date < format(new Date(), "yyyy-MM-dd")).reduce((s, p) => s + p.amount, 0);

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.students?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || p.status === filterStatus ||
      (filterStatus === "atrasado" && p.status === "pendente" && p.due_date < format(new Date(), "yyyy-MM-dd"));
    return matchSearch && matchStatus;
  });

  const statusBadge = (p: Payment) => {
    if (p.status === "pago") return "bg-accent/10 text-accent border-accent/20";
    if (p.status === "pendente" && p.due_date < format(new Date(), "yyyy-MM-dd")) return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-warning/10 text-warning border-warning/20";
  };

  const statusLabel = (p: Payment) => {
    if (p.status === "pago") return "pago";
    if (p.status === "pendente" && p.due_date < format(new Date(), "yyyy-MM-dd")) return "atrasado";
    return "pendente";
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-title">Financeiro</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="rounded-lg shadow-sm"><Plus className="h-4 w-4 mr-1.5" /> Novo Pagamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-lg">{editing ? "Editar Pagamento" : "Novo Pagamento"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-3">
              {/* Payment type toggle */}
              {!editing && (
                <div className="flex bg-muted rounded-lg p-0.5">
                  <button onClick={() => setInstallmentMode(false)} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!installmentMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>À vista</button>
                  <button onClick={() => setInstallmentMode(true)} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${installmentMode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Parcelado</button>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Aluno</Label>
                <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {form.student_id && getStudentPackages(form.student_id).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pacote (opcional)</Label>
                  <Select value={form.package_id} onValueChange={v => {
                    setForm({ ...form, package_id: v });
                    if (installmentMode) {
                      const pkg = packages.find(p => p.id === v);
                      if (pkg) setInstallmentTotal(pkg.total_value);
                    }
                  }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Vincular a pacote" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Nenhum</SelectItem>
                      {getStudentPackages(form.student_id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · R$ {p.total_value.toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {installmentMode && !editing ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium">Valor Total (R$)</Label><Input type="number" value={installmentTotal || ""} onChange={e => setInstallmentTotal(parseFloat(e.target.value) || 0)} className="h-9" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium">Parcelas</Label><Input type="number" min={2} value={installmentCount} onChange={e => setInstallmentCount(parseInt(e.target.value) || 2)} className="h-9" /></div>
                  </div>
                  {installmentTotal > 0 && installmentCount >= 2 && (
                    <p className="text-xs text-muted-foreground">{installmentCount}x de <span className="font-semibold text-foreground">R$ {(installmentTotal / installmentCount).toFixed(2)}</span></p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium">1º Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="h-9" /></div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Forma</Label>
                      <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="transferencia">Transferência</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleCreateInstallments} className="h-10 rounded-lg">Criar {installmentCount} Parcelas</Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium">Valor (R$)</Label><Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium">Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="h-9" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Status</Label>
                      <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium">Data pagamento</Label><Input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} className="h-9" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Forma de pagamento</Label>
                    <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="transferencia">Transferência</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" /></div>
                  <Button onClick={handleSave} className="h-10 rounded-lg">{editing ? "Salvar" : "Registrar"}</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-accent/8 flex items-center justify-center"><ArrowUpRight className="h-3.5 w-3.5 text-accent" /></div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Recebido</span>
            </div>
            <p className="text-xl font-bold text-accent">R$ {totalReceived.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-warning/8 flex items-center justify-center"><DollarSign className="h-3.5 w-3.5 text-warning" /></div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Pendente</span>
            </div>
            <p className="text-xl font-bold text-warning">R$ {totalPending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-destructive/8 flex items-center justify-center"><ArrowDownRight className="h-3.5 w-3.5 text-destructive" /></div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Em atraso</span>
            </div>
            <p className="text-xl font-bold text-destructive">R$ {totalOverdue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-9 rounded-lg bg-card border-border/60" placeholder="Buscar por aluno..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {["todos", "pendente", "pago", "atrasado"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filterStatus === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Payment List */}
      {filtered.length === 0 ? (
        <Card className="card-premium"><CardContent className="py-16 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="card-premium hover:shadow-md transition-all duration-200">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.students?.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">Vence: {p.due_date}</span>
                    {p.payment_method && <span className="text-[10px] text-muted-foreground/60 uppercase">{p.payment_method}</span>}
                    {p.total_installments && p.total_installments > 1 && (
                      <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                        <CreditCard className="h-3 w-3" /> {p.installment_number}/{p.total_installments}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-base font-bold">R$ {p.amount.toFixed(2)}</p>
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border mt-0.5 ${statusBadge(p)}`}>{statusLabel(p)}</Badge>
                  </div>
                  {p.status !== "pago" && (
                    <Button variant="ghost" size="sm" onClick={() => markPaid(p)} className="h-8 w-8 p-0 rounded-lg text-accent hover:bg-accent/10">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-8 text-xs rounded-lg">Editar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
