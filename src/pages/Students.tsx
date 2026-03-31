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
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Edit, Trash2, Phone, Mail, User, BookOpen, Clock, Package, AlertTriangle, Eye, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addMonths } from "date-fns";

interface Student {
  id: string; name: string; phone: string; email: string;
  guardian_name: string; guardian_phone: string; subject: string;
  lesson_content: string; modality: string; hourly_rate: number;
  notes: string; status: string; hours_contracted: number;
  hours_remaining: number; teacher_id: string;
}

interface StudentPackage {
  id: string; student_id: string; teacher_id: string; name: string;
  hours_total: number; hours_used: number; total_value: number;
  hourly_rate: number; expires_at: string | null; status: string;
}

interface Payment {
  id: string; student_id: string; amount: number; status: string;
  due_date: string; paid_date: string | null; installment_number: number | null;
  total_installments: number | null; payment_method: string;
  package_id: string | null;
}

const PRESET_PACKAGES = [
  { label: "5h", hours: 5 },
  { label: "8h", hours: 8 },
  { label: "10h", hours: 10 },
  { label: "12h", hours: 12 },
  { label: "20h", hours: 20 },
];

const emptyForm = {
  name: "", phone: "", email: "", subject: "", modality: "online",
  notes: "", status: "ativo",
  // Package fields
  package_hours: 0, package_value: 0,
  // Payment fields
  payment_method: "avista", installments: 1, payment_date: format(new Date(), "yyyy-MM-dd"),
};

export default function Students() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Record<string, StudentPackage[]>>({});
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    const { data: studs } = await supabase.from("students").select("*").eq("teacher_id", user!.id).order("name");
    setStudents(studs || []);

    const { data: pkgs } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    const grouped: Record<string, StudentPackage[]> = {};
    (pkgs || []).forEach((p: any) => {
      if (!grouped[p.student_id]) grouped[p.student_id] = [];
      grouped[p.student_id].push(p);
    });
    setPackages(grouped);

    const { data: pays } = await supabase.from("payments").select("*").eq("teacher_id", user!.id).order("due_date");
    const payGrouped: Record<string, Payment[]> = {};
    (pays || []).forEach((p: any) => {
      if (!payGrouped[p.student_id]) payGrouped[p.student_id] = [];
      payGrouped[p.student_id].push(p);
    });
    setPayments(payGrouped);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (!editing && form.package_hours <= 0) { toast({ title: "Selecione um pacote de horas", variant: "destructive" }); return; }

    const studentData = {
      name: form.name, phone: form.phone, email: form.email,
      subject: form.subject, modality: form.modality, notes: form.notes,
      status: form.status, guardian_name: "", guardian_phone: "",
      lesson_content: "", hourly_rate: form.package_value > 0 && form.package_hours > 0 ? form.package_value / form.package_hours : 0,
    };

    if (editing) {
      const { error } = await supabase.from("students").update(studentData).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aluno atualizado!" });
    } else {
      // Create student
      const { data: newStudent, error } = await supabase.from("students")
        .insert({ ...studentData, teacher_id: user!.id, hours_contracted: form.package_hours, hours_remaining: form.package_hours })
        .select().single();
      if (error || !newStudent) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }

      // Create package
      const hourlyRate = form.package_value > 0 ? form.package_value / form.package_hours : 0;
      const { data: newPkg } = await supabase.from("packages").insert({
        teacher_id: user!.id, student_id: newStudent.id,
        name: `Pacote ${form.package_hours}h`, hours_total: form.package_hours,
        hours_used: 0, total_value: form.package_value, hourly_rate: Math.round(hourlyRate * 100) / 100,
        expires_at: null, status: "ativo",
      }).select().single();

      // Create payment(s)
      if (form.package_value > 0) {
        const numInstallments = form.payment_method === "parcelado" ? Math.max(1, form.installments) : 1;
        const installmentValue = Math.round((form.package_value / numInstallments) * 100) / 100;

        const paymentInserts = [];
        for (let i = 0; i < numInstallments; i++) {
          const dueDate = i === 0
            ? form.payment_date
            : format(addMonths(new Date(form.payment_date), i), "yyyy-MM-dd");
          paymentInserts.push({
            teacher_id: user!.id, student_id: newStudent.id,
            amount: installmentValue, due_date: dueDate,
            status: "pendente", payment_method: form.payment_method,
            installment_number: numInstallments > 1 ? i + 1 : null,
            total_installments: numInstallments > 1 ? numInstallments : null,
            package_id: newPkg?.id || null,
          });
        }
        await supabase.from("payments").insert(paymentInserts);
      }

      toast({ title: "Aluno cadastrado com pacote e pagamento!" });
    }
    setDialogOpen(false); setEditing(null); setForm(emptyForm); loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aluno e todos os dados vinculados?")) return;
    await supabase.from("payments").delete().eq("student_id", id);
    await supabase.from("lessons").delete().eq("student_id", id);
    await supabase.from("packages").delete().eq("student_id", id);
    await supabase.from("students").delete().eq("id", id);
    toast({ title: "Aluno excluído" }); loadAll();
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setForm({
      ...emptyForm, name: student.name, phone: student.phone, email: student.email,
      subject: student.subject, modality: student.modality, notes: student.notes, status: student.status,
    });
    setDialogOpen(true);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const getActivePackage = (studentId: string) => (packages[studentId] || []).find(p => p.status === "ativo");

  const getHoursInfo = (studentId: string) => {
    const activePkgs = (packages[studentId] || []).filter(p => p.status === "ativo");
    const totalHours = activePkgs.reduce((s, p) => s + p.hours_total, 0);
    const usedHours = activePkgs.reduce((s, p) => s + p.hours_used, 0);
    const remaining = totalHours - usedHours;
    const percentage = totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0;
    return { totalHours, usedHours, remaining, percentage };
  };

  const getStudentPayments = (studentId: string) => payments[studentId] || [];

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.subject?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusBadge = (s: string) =>
    s === "ativo" ? "bg-accent/10 text-accent border-accent/30" :
    s === "pausado" ? "bg-warning/10 text-warning border-warning/30" :
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="section-subtitle">{students.length} cadastrado(s) · {students.filter(s => s.status === "ativo").length} ativo(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="rounded-lg shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? "Editar Aluno" : "Cadastrar Aluno"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-3">
              {/* Dados pessoais */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados do Aluno</legend>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome do Aluno *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9" placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9" placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Disciplina</Label>
                    <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-9" placeholder="Ex: Matemática" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Modalidade</Label>
                    <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="presencial">Presencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              {/* Pacote - only for new students */}
              {!editing && (
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pacote de Horas</legend>
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Escolha o pacote *</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_PACKAGES.map(p => (
                        <button key={p.hours} onClick={() => setForm({ ...form, package_hours: p.hours })}
                          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${form.package_hours === p.hours ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Horas</Label>
                      <Input type="number" value={form.package_hours || ""} onChange={e => setForm({ ...form, package_hours: parseFloat(e.target.value) || 0 })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Valor do Pacote (R$)</Label>
                      <Input type="number" value={form.package_value || ""} onChange={e => setForm({ ...form, package_value: parseFloat(e.target.value) || 0 })} className="h-9" placeholder="0,00" />
                    </div>
                  </div>
                  {form.package_hours > 0 && form.package_value > 0 && (
                    <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground">Valor por hora: <span className="font-bold text-primary text-sm">R$ {(form.package_value / form.package_hours).toFixed(2)}</span></p>
                    </div>
                  )}
                </fieldset>
              )}

              {/* Pagamento - only for new students */}
              {!editing && form.package_value > 0 && (
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagamento</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Forma de Pagamento</Label>
                      <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v, installments: v === "avista" ? 1 : form.installments })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="avista">À Vista</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.payment_method === "parcelado" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Quantidade de Parcelas</Label>
                        <Input type="number" min={2} max={12} value={form.installments} onChange={e => setForm({ ...form, installments: parseInt(e.target.value) || 2 })} className="h-9" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Data do Pagamento</Label>
                    <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="h-9" />
                  </div>
                  {form.payment_method === "parcelado" && form.installments > 1 && (
                    <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/40">
                      <p className="text-xs text-muted-foreground">
                        {form.installments}x de <span className="font-bold text-foreground">R$ {(form.package_value / form.installments).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </fieldset>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" placeholder="Anotações sobre o aluno..." />
              </div>

              <Button onClick={handleSave} className="w-full h-10 rounded-lg font-medium">
                {editing ? "Salvar Alterações" : "Cadastrar Aluno"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-10 rounded-lg bg-card border-border/60" placeholder="Buscar por nome ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {["todos", "ativo", "pausado", "inativo"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filterStatus === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      {filtered.length === 0 ? (
        <Card className="card-premium"><CardContent className="py-16 text-center">
          <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const info = getHoursInfo(s.id);
            const activePkg = getActivePackage(s.id);
            const lowHours = info.remaining > 0 && info.remaining <= 2;
            return (
              <Card key={s.id} className="card-premium hover:shadow-md transition-all duration-200 group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{s.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.subject || "Sem disciplina"} · {s.modality}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusBadge(s.status)}`}>{s.status}</Badge>
                  </div>

                  {/* Hours progress */}
                  {activePkg && (
                    <div className="mb-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {info.usedHours}h / {info.totalHours}h
                        </span>
                        <span className={`font-semibold ${lowHours ? "text-destructive" : "text-accent"}`}>
                          {info.remaining}h restantes ({info.percentage}%)
                          {lowHours && <AlertTriangle className="h-3 w-3 inline ml-0.5" />}
                        </span>
                      </div>
                      <Progress value={info.percentage} className="h-2" />
                    </div>
                  )}

                  {activePkg && (
                    <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {activePkg.name} · R$ {activePkg.total_value.toFixed(2)}
                    </div>
                  )}

                  {s.phone && <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary hover:bg-primary/10" onClick={() => setDetailStudent(s)}>
                      <Eye className="h-3 w-3 mr-1" /> Detalhes
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10" onClick={() => openEdit(s)}>
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onOpenChange={() => setDetailStudent(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailStudent?.name}</DialogTitle></DialogHeader>
          {detailStudent && (() => {
            const info = getHoursInfo(detailStudent.id);
            const activePkg = getActivePackage(detailStudent.id);
            const studentPayments = getStudentPayments(detailStudent.id);
            const paidPayments = studentPayments.filter(p => p.status === "pago");
            const pendingPayments = studentPayments.filter(p => p.status === "pendente");
            return (
              <div className="space-y-5 py-2">
                {/* Contact info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Disciplina</p><p className="font-medium">{detailStudent.subject || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Modalidade</p><p className="font-medium capitalize">{detailStudent.modality}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telefone</p><p className="font-medium">{detailStudent.phone || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">E-mail</p><p className="font-medium">{detailStudent.email || "—"}</p></div>
                </div>

                {/* Package summary */}
                {activePkg && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Resumo do Pacote</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-[11px] text-muted-foreground">Pacote</p><p className="font-bold">{activePkg.name}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Valor</p><p className="font-bold">R$ {activePkg.total_value.toFixed(2)}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Horas Contratadas</p><p className="font-bold text-primary">{info.totalHours}h</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Horas Utilizadas</p><p className="font-bold">{info.usedHours}h</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Horas Restantes</p><p className="font-bold text-accent">{info.remaining}h</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Consumido</p><p className="font-bold">{info.percentage}%</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{info.percentage}% consumido</span>
                        <span>{100 - info.percentage}% restante</span>
                      </div>
                      <Progress value={info.percentage} className="h-2.5" />
                    </div>
                  </div>
                )}

                {/* Payment info */}
                {studentPayments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Forma</p>
                        <p className="font-medium capitalize">{studentPayments[0]?.payment_method === "avista" ? "À Vista" : "Parcelado"}</p>
                      </div>
                      {studentPayments[0]?.total_installments && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Parcelas</p>
                          <p className="font-medium">{paidPayments.length}/{studentPayments[0].total_installments} pagas</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {studentPayments.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border border-border/30">
                          <span className="text-muted-foreground">
                            {p.total_installments ? `${p.installment_number}/${p.total_installments}` : "Pgto"} · {p.due_date}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">R$ {p.amount.toFixed(2)}</span>
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${p.status === "pago" ? "bg-accent/10 text-accent border-accent/30" : "bg-warning/10 text-warning border-warning/30"}`}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailStudent.notes && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                    <p className="text-sm">{detailStudent.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
