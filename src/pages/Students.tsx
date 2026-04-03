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
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit, Trash2, Phone, Mail, User, Clock, Package, AlertTriangle, Eye, CreditCard, Pencil, KeyRound, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addMonths } from "date-fns";
import { formatHoursDisplay } from "@/lib/formatMinutes";

interface StudentAccessRecord {
  id: string;
  student_id: string;
  user_id: string;
  teacher_id: string;
  is_active: boolean;
  permissions: {
    view_hours: boolean;
    view_schedule: boolean;
    view_history: boolean;
    view_absences: boolean;
    view_financial: boolean;
    view_payments: boolean;
  };
}

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
  package_id: string | null; notes: string;
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
  package_hours: "" as string | number, package_value: "" as string | number,
  payment_method: "avista", installments: "" as string | number,
  payment_date: format(new Date(), "yyyy-MM-dd"),
  discount_percent: "" as string | number,
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
  const [editingPackage, setEditingPackage] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState(false);

  // Student access state
  const [accessRecords, setAccessRecords] = useState<Record<string, StudentAccessRecord>>({});
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessPerms, setAccessPerms] = useState({
    view_hours: true, view_schedule: true, view_history: true,
    view_absences: true, view_financial: false, view_payments: false,
  });

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    const { data: studs } = await supabase.from("students").select("*").eq("teacher_id", user!.id).order("name");
    setStudents(studs || []);
    const { data: pkgs } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    const grouped: Record<string, StudentPackage[]> = {};
    (pkgs || []).forEach((p: any) => { if (!grouped[p.student_id]) grouped[p.student_id] = []; grouped[p.student_id].push(p); });
    setPackages(grouped);
    const { data: pays } = await supabase.from("payments").select("*").eq("teacher_id", user!.id).order("due_date");
    const payGrouped: Record<string, Payment[]> = {};
    (pays || []).forEach((p: any) => { if (!payGrouped[p.student_id]) payGrouped[p.student_id] = []; payGrouped[p.student_id].push(p); });
    setPayments(payGrouped);
    // Load student access records
    const { data: accesses } = await (supabase.from as any)("student_access")
      .select("*").eq("teacher_id", user!.id);
    const accessMap: Record<string, StudentAccessRecord> = {};
    (accesses || []).forEach((a: any) => { accessMap[a.student_id] = a; });
    setAccessRecords(accessMap);
  };

  const numVal = (v: string | number): number => { const n = typeof v === "string" ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };

  const packageValue = numVal(form.package_value);
  const packageHours = numVal(form.package_hours);
  const discountPercent = numVal(form.discount_percent);
  const installments = Math.max(1, Math.round(numVal(form.installments)) || 1);
  const hourlyRate = packageHours > 0 && packageValue > 0 ? packageValue / packageHours : 0;
  const discountAmount = form.payment_method === "avista" && discountPercent > 0 ? packageValue * (discountPercent / 100) : 0;
  const finalValue = packageValue - discountAmount;
  const installmentValue = form.payment_method === "parcelado" && installments > 0 ? finalValue / installments : finalValue;

  const installmentPreview = () => {
    if (form.payment_method !== "parcelado" || installments < 2 || !form.payment_date) return [];
    const list = [];
    for (let i = 0; i < installments; i++) {
      const d = i === 0 ? new Date(form.payment_date + "T12:00:00") : addMonths(new Date(form.payment_date + "T12:00:00"), i);
      list.push({ num: i + 1, value: installmentValue, date: format(d, "dd/MM/yyyy"), dateISO: format(d, "yyyy-MM-dd") });
    }
    return list;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (!editing && packageHours <= 0) { toast({ title: "Selecione um pacote de horas", variant: "destructive" }); return; }

    const studentData = {
      name: form.name, phone: form.phone, email: form.email,
      subject: form.subject, modality: form.modality, notes: form.notes,
      status: form.status, guardian_name: "", guardian_phone: "",
      lesson_content: "", hourly_rate: hourlyRate,
    };

    if (editing) {
      await supabase.from("students").update(studentData).eq("id", editing.id);

      if (editingPackage) {
        const activePkg = getActivePackage(editing.id);
        if (activePkg) {
          const newHourlyRate = packageHours > 0 && finalValue > 0 ? finalValue / packageHours : 0;
          await supabase.from("packages").update({
            name: `Pacote ${packageHours}h`, hours_total: packageHours,
            total_value: finalValue, hourly_rate: Math.round(newHourlyRate * 100) / 100,
          }).eq("id", activePkg.id);
          await supabase.from("students").update({ hours_contracted: packageHours }).eq("id", editing.id);
        }
      }

      if (editingFinancial) {
        // Delete old payments and recreate
        await supabase.from("payments").delete().eq("student_id", editing.id);
        if (finalValue > 0) await createPayments(editing.id, getActivePackage(editing.id)?.id || null);
      }

      toast({ title: "Aluno atualizado!" });
    } else {
      const { data: newStudent, error } = await supabase.from("students")
        .insert({ ...studentData, teacher_id: user!.id, hours_contracted: packageHours, hours_remaining: packageHours })
        .select().single();
      if (error || !newStudent) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }

      const { data: newPkg } = await supabase.from("packages").insert({
        teacher_id: user!.id, student_id: newStudent.id,
        name: `Pacote ${packageHours}h`, hours_total: packageHours,
        hours_used: 0, total_value: finalValue,
        hourly_rate: Math.round((finalValue / packageHours) * 100) / 100,
        expires_at: null, status: "ativo",
      }).select().single();

      if (finalValue > 0) await createPayments(newStudent.id, newPkg?.id || null);
      toast({ title: "Aluno cadastrado com sucesso!" });
    }
    setDialogOpen(false); setEditing(null); setEditingPackage(false); setEditingFinancial(false); setForm(emptyForm); loadAll();
  };

  const createPayments = async (studentId: string, packageId: string | null) => {
    const numInst = form.payment_method === "parcelado" ? Math.max(1, installments) : 1;
    const perInst = Math.round((finalValue / numInst) * 100) / 100;
    const inserts = [];
    for (let i = 0; i < numInst; i++) {
      const dueDate = i === 0 ? form.payment_date : format(addMonths(new Date(form.payment_date + "T12:00:00"), i), "yyyy-MM-dd");
      inserts.push({
        teacher_id: user!.id, student_id: studentId, amount: perInst, due_date: dueDate,
        status: "pendente", payment_method: form.payment_method,
        installment_number: numInst > 1 ? i + 1 : null,
        total_installments: numInst > 1 ? numInst : null,
        package_id: packageId, notes: "",
      });
    }
    await supabase.from("payments").insert(inserts);
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
    const activePkg = getActivePackage(student.id);
    const stuPayments = getStudentPayments(student.id);
    setEditing(student); setEditingPackage(false); setEditingFinancial(false);
    setForm({
      name: student.name, phone: student.phone, email: student.email,
      subject: student.subject, modality: student.modality, notes: student.notes, status: student.status,
      package_hours: activePkg?.hours_total || "",
      package_value: activePkg?.total_value || "",
      payment_method: stuPayments[0]?.payment_method || "avista",
      installments: stuPayments[0]?.total_installments || "",
      payment_date: stuPayments[0]?.due_date || format(new Date(), "yyyy-MM-dd"),
      discount_percent: "",
    });
    setDialogOpen(true);
  };

  const openNew = () => { setEditing(null); setEditingPackage(false); setEditingFinancial(false); setForm(emptyForm); setDialogOpen(true); };

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

  const showPackageFields = !editing || editingPackage;
  const showPaymentFields = (!editing || editingFinancial) && finalValue > 0;

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="section-subtitle">{students.length} cadastrado(s) · {students.filter(s => s.status === "ativo").length} ativo(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setEditingPackage(false); setEditingFinancial(false); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="rounded-xl shadow-sm gap-1.5">
              <Plus className="h-4 w-4" /> Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{editing ? "Editar Aluno" : "Cadastrar Aluno"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              {/* Personal Data */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Dados do Aluno</legend>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl" placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-xl" placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-10 rounded-xl" placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Disciplina</Label>
                    <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: Matemática" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Modalidade</Label>
                    <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="presencial">Presencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              {/* Package Section */}
              {editing && !editingPackage ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Pacote:</span>{" "}
                    <span className="font-semibold">{getActivePackage(editing.id)?.name || "—"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => setEditingPackage(true)}>
                    <Pencil className="h-3 w-3" /> Ajustar
                  </Button>
                </div>
              ) : null}

              {showPackageFields && (
                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Pacote de Horas</legend>
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Escolha o pacote *</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_PACKAGES.map(p => (
                        <button key={p.hours} onClick={() => setForm({ ...form, package_hours: p.hours })}
                          className={`px-4 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${numVal(form.package_hours) === p.hours ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Horas</Label>
                      <Input type="number" value={form.package_hours} onChange={e => setForm({ ...form, package_hours: e.target.value })} className="h-10 rounded-xl" placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Valor do Pacote (R$)</Label>
                      <Input type="number" value={form.package_value} onChange={e => setForm({ ...form, package_value: e.target.value })} className="h-10 rounded-xl" placeholder="0,00" />
                    </div>
                  </div>
                  {packageHours > 0 && packageValue > 0 && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <p className="text-xs text-muted-foreground">Valor por hora: <span className="font-bold text-primary text-base">R$ {hourlyRate.toFixed(2)}</span></p>
                    </div>
                  )}
                </fieldset>
              )}

              {/* Payment Section */}
              {editing && !editingFinancial ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Pagamento:</span>{" "}
                    <span className="font-semibold capitalize">{getStudentPayments(editing.id)[0]?.payment_method === "parcelado" ? "Parcelado" : "À Vista"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={() => setEditingFinancial(true)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
              ) : null}

              {showPaymentFields && (
                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Pagamento</legend>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Forma de Pagamento</Label>
                    <div className="flex bg-muted rounded-xl p-1">
                      <button onClick={() => setForm({ ...form, payment_method: "avista", installments: "" })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${form.payment_method === "avista" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>À Vista</button>
                      <button onClick={() => setForm({ ...form, payment_method: "parcelado", discount_percent: "" })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${form.payment_method === "parcelado" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Parcelado</button>
                    </div>
                  </div>

                  {form.payment_method === "avista" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Desconto (%)</Label>
                        <Input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: 10" />
                      </div>
                      {discountPercent > 0 && packageValue > 0 && (
                        <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 space-y-1">
                          <p className="text-xs text-muted-foreground">Valor original: <span className="line-through">R$ {packageValue.toFixed(2)}</span></p>
                          <p className="text-xs text-muted-foreground">Desconto ({discountPercent}%): <span className="text-accent font-semibold">-R$ {discountAmount.toFixed(2)}</span></p>
                          <p className="text-sm font-bold text-accent">Valor à vista: R$ {finalValue.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {form.payment_method === "parcelado" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Quantidade de Parcelas</Label>
                      <Input type="number" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: 3" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{form.payment_method === "parcelado" ? "Data da 1ª Parcela" : "Data do Pagamento"}</Label>
                    <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="h-10 rounded-xl" />
                  </div>

                  {/* Installment preview */}
                  {form.payment_method === "parcelado" && installments >= 2 && packageValue > 0 && (
                    <div className="p-3 rounded-xl bg-muted/50 border border-border/40 space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Resumo do Parcelamento</p>
                      {installmentPreview().map(p => (
                        <div key={p.num} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                          <span className="text-muted-foreground">Parcela {p.num} — {p.date}</span>
                          <span className="font-bold">R$ {p.value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm rounded-xl" placeholder="Anotações sobre o aluno..." />
              </div>

              <Button onClick={handleSave} className="w-full h-11 rounded-xl font-semibold text-sm">
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
          <Input className="pl-10 h-10 rounded-xl bg-card border-border/60" placeholder="Buscar por nome ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-muted rounded-xl p-1 shrink-0">
          {["todos", "ativo", "pausado", "inativo"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${filterStatus === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      {filtered.length === 0 ? (
        <Card className="card-premium"><CardContent className="py-16 text-center">
          <User className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const info = getHoursInfo(s.id);
            const activePkg = getActivePackage(s.id);
            const lowHours = info.remaining > 0 && info.remaining <= 2;
            return (
              <Card key={s.id} className="card-premium hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{s.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.subject || "Sem disciplina"} · {s.modality}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusBadge(s.status)}`}>{s.status}</Badge>
                  </div>

                  {activePkg && (
                    <div className="mb-3 space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatHoursDisplay(info.usedHours)} / {formatHoursDisplay(info.totalHours)}</span>
                        <span className={`font-bold ${lowHours ? "text-destructive" : "text-accent"}`}>
                          {formatHoursDisplay(info.remaining)} restantes
                          {lowHours && <AlertTriangle className="h-3 w-3 inline ml-0.5" />}
                        </span>
                      </div>
                      <Progress value={info.percentage} className="h-2" />
                      <p className="text-[10px] text-muted-foreground text-right">{info.percentage}% consumido</p>
                    </div>
                  )}

                  {activePkg && (
                    <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                      <Package className="h-3 w-3" /> {activePkg.name} · R$ {activePkg.total_value.toFixed(2)}
                    </div>
                  )}

                  {s.phone && <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg text-primary hover:bg-primary/10 gap-1" onClick={() => setDetailStudent(s)}>
                      <Eye className="h-3.5 w-3.5" /> Detalhes
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10" onClick={() => openEdit(s)}>
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
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
          <DialogHeader><DialogTitle className="text-lg font-bold">{detailStudent?.name}</DialogTitle></DialogHeader>
          {detailStudent && (() => {
            const info = getHoursInfo(detailStudent.id);
            const activePkg = getActivePackage(detailStudent.id);
            const studentPayments = getStudentPayments(detailStudent.id);
            const paidPayments = studentPayments.filter(p => p.status === "pago");
            return (
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Disciplina</p><p className="font-semibold">{detailStudent.subject || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Modalidade</p><p className="font-semibold capitalize">{detailStudent.modality}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telefone</p><p className="font-semibold">{detailStudent.phone || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">E-mail</p><p className="font-semibold">{detailStudent.email || "—"}</p></div>
                </div>

                {activePkg && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 space-y-3">
                    <h3 className="text-[11px] font-bold text-primary uppercase tracking-widest">Resumo do Pacote</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-[11px] text-muted-foreground">Pacote</p><p className="font-bold">{activePkg.name}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Valor</p><p className="font-bold">R$ {activePkg.total_value.toFixed(2)}</p></div>
                       <div><p className="text-[11px] text-muted-foreground">Horas Contratadas</p><p className="font-bold text-primary">{formatHoursDisplay(info.totalHours)}</p></div>
                       <div><p className="text-[11px] text-muted-foreground">Horas Abatidas</p><p className="font-bold">{formatHoursDisplay(info.usedHours)}</p></div>
                       <div><p className="text-[11px] text-muted-foreground">Horas Restantes</p><p className="font-bold text-accent">{formatHoursDisplay(info.remaining)}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Consumido</p><p className="font-bold">{info.percentage}%</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{info.percentage}% consumido</span>
                        <span>{100 - info.percentage}% restante</span>
                      </div>
                      <Progress value={info.percentage} className="h-2.5" />
                    </div>
                  </div>
                )}

                {studentPayments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Pagamento</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Forma</p>
                        <p className="font-semibold capitalize">{studentPayments[0]?.payment_method === "avista" ? "À Vista" : "Parcelado"}</p>
                      </div>
                      {studentPayments[0]?.total_installments && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Parcelas</p>
                          <p className="font-semibold">{paidPayments.length}/{studentPayments[0].total_installments} pagas</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {studentPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/40 border border-border/30">
                          <span className="text-muted-foreground">
                            {p.total_installments ? `${p.installment_number}/${p.total_installments}` : "Pgto"} · {p.due_date}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">R$ {p.amount.toFixed(2)}</span>
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

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs gap-1" onClick={() => { setDetailStudent(null); openEdit(detailStudent); }}>
                    <Edit className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
