import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, TrendingUp, AlertCircle, Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Payment {
  id: string;
  student_id: string;
  teacher_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string;
  notes: string;
  students?: { name: string };
}

interface Student { id: string; name: string; }

export default function Financial() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [form, setForm] = useState({
    student_id: "", amount: 0, due_date: format(new Date(), "yyyy-MM-dd"),
    paid_date: "", status: "pendente", payment_method: "", notes: "",
  });

  useEffect(() => {
    if (user) { loadPayments(); loadStudents(); }
  }, [user]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("id,name").eq("teacher_id", user!.id);
    setStudents(data || []);
  };

  const loadPayments = async () => {
    const { data } = await supabase.from("payments").select("*, students(name)")
      .eq("teacher_id", user!.id).order("due_date", { ascending: false });
    setPayments(data || []);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.amount) { toast({ title: "Preencha aluno e valor", variant: "destructive" }); return; }
    const payload = { ...form, teacher_id: user!.id, paid_date: form.paid_date || null };
    if (editing) {
      await supabase.from("payments").update(payload).eq("id", editing.id);
      toast({ title: "Pagamento atualizado!" });
    } else {
      await supabase.from("payments").insert(payload);
      toast({ title: "Pagamento registrado!" });
    }
    setDialogOpen(false); setEditing(null); loadPayments();
  };

  const markPaid = async (p: Payment) => {
    await supabase.from("payments").update({ status: "pago", paid_date: format(new Date(), "yyyy-MM-dd") }).eq("id", p.id);
    toast({ title: "Marcado como pago!" });
    loadPayments();
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({ student_id: p.student_id, amount: p.amount, due_date: p.due_date, paid_date: p.paid_date || "", status: p.status, payment_method: p.payment_method || "", notes: p.notes || "" });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ student_id: "", amount: 0, due_date: format(new Date(), "yyyy-MM-dd"), paid_date: "", status: "pendente", payment_method: "", notes: "" });
    setDialogOpen(true);
  };

  const totalReceived = payments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pendente").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === "pendente" && p.due_date < format(new Date(), "yyyy-MM-dd")).reduce((s, p) => s + p.amount, 0);

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.students?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Pagamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Pagamento" : "Novo Pagamento"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Aluno</Label>
                <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Data pagamento</Label><Input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Registrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold text-success">R$ {totalReceived.toFixed(2)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">Pendente</p><p className="text-xl font-bold text-warning">R$ {totalPending.toFixed(2)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Em atraso</p><p className="text-xl font-bold text-destructive">R$ {totalOverdue.toFixed(2)}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por aluno..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum pagamento encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold">{p.students?.name}</p>
                    <p className="text-sm text-muted-foreground">Vence: {p.due_date}</p>
                    {p.payment_method && <p className="text-xs text-muted-foreground">{p.payment_method}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ {p.amount.toFixed(2)}</p>
                    <Badge variant="outline" className={
                      p.status === "pago" ? "bg-success/10 text-success" :
                      p.status === "atrasado" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/10 text-warning"
                    }>{p.status}</Badge>
                  </div>
                  {p.status !== "pago" && (
                    <Button variant="outline" size="sm" onClick={() => markPaid(p)}>
                      <Check className="h-4 w-4 mr-1" /> Pagar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
