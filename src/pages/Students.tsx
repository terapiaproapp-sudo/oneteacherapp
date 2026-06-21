import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit, Trash2, Phone, Mail, User, Clock, Package, AlertTriangle, Eye, CreditCard, Pencil, KeyRound, ShieldCheck, ShieldOff, Loader2, FileText, Calendar as CalendarIcon, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addMonths } from "date-fns";
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";
import NewPackageDialog from "@/components/students/NewPackageDialog";
import PackageHistory from "@/components/students/PackageHistory";
import TransferExcessDialog from "@/components/students/TransferExcessDialog";
import { statusBadgeClasses, statusLabel } from "@/lib/packageUtils";

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
  hours_remaining: number; teacher_id: string; enrollment_type: string;
}
interface StudentPackage {
  id: string; student_id: string; teacher_id: string; name: string;
  hours_total: number; hours_used: number; total_value: number;
  hourly_rate: number; expires_at: string | null; status: string;
  created_at?: string;
}
interface Payment {
  id: string; student_id: string; amount: number; status: string;
  due_date: string; paid_date: string | null; installment_number: number | null;
  total_installments: number | null; payment_method: string;
  package_id: string | null; notes: string;
}

const parseHoursToMinutes = (hoursStr: string): number => {
  if (!hoursStr) return 0;
  if (hoursStr.includes("h")) {
    const parts = hoursStr.split("h");
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }
  const floatVal = parseFloat(hoursStr.replace(",", "."));
  return isNaN(floatVal) ? 0 : Math.round(floatVal * 60);
};

const formatMinutesToHoursInput = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
};

const emptyForm = {
  name: "", phone: "", email: "", subject: "", modality: "online",
  notes: "", status: "ativo", enrollment_type: "pacote",
  package_hours: "" as string | number, package_value: "" as string | number,
  payment_method: "avista", installments: "" as string | number,
  payment_date: format(new Date(), "yyyy-MM-dd"),
  discount_percent: "" as string | number,
  hourly_rate: "" as string | number,
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
  const [summaryStudent, setSummaryStudent] = useState<Student | null>(null);
  const [studentLessons, setStudentLessons] = useState<any[]>([]);
  const [studentLessonsSummary, setStudentLessonsSummary] = useState({
    packageHoursConsumed: 0,
    avulsaCount: 0,
    avulsaPaid: 0,
    avulsaPending: 0
  });
  const [editingPackage, setEditingPackage] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [newPkgStudent, setNewPkgStudent] = useState<Student | null>(null);
  const [excessTransfer, setExcessTransfer] = useState<{ source: StudentPackage; dest: StudentPackage | null; student: Student } | null>(null);

  // Student access state
  const [accessRecords, setAccessRecords] = useState<Record<string, StudentAccessRecord>>({});
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessPerms, setAccessPerms] = useState({
    view_hours: true, view_schedule: true, view_history: true,
    view_absences: true, view_financial: false, view_payments: false,
  });
  const [editingAccessPerms, setEditingAccessPerms] = useState(false);
  const [editingAccessPassword, setEditingAccessPassword] = useState(false);
  const [newAccessPassword, setNewAccessPassword] = useState("");

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    try {
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
    } catch (error) {
      console.error("Error loading students:", error);
      toast({ title: "Erro ao carregar alunos", variant: "destructive" });
    }
  };

  const numVal = (v: string | number): number => { const n = typeof v === "string" ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };

  // ===== Student Access Functions =====
  const createStudentAccess = async (studentId: string, studentName: string) => {
    if (!accessEmail || !accessPassword) {
      toast({ title: "E-mail e senha são obrigatórios", variant: "destructive" });
      return;
    }
    if (accessEmail.trim() === "") {
      toast({ title: "E-mail não pode estar vazio", variant: "destructive" });
      return;
    }
    if (accessPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(accessEmail)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    
    setAccessLoading(true);
    try {
      const res = await supabase.functions.invoke("create-student-access", {
        body: { student_id: studentId, email: accessEmail, password: accessPassword, student_name: studentName },
      });
      
      // Check for errors in the response
      if (res.error) {
        const errorMsg = res.error?.message || "Erro ao criar acesso";
        throw new Error(errorMsg);
      }
      
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      
      if (!res.data?.success) {
        throw new Error("Erro desconhecido ao criar acesso do aluno");
      }

      // Update permissions
      const access = await (supabase.from as any)("student_access")
        .select("*").eq("student_id", studentId).single();
      if (access.data) {
        await (supabase.from as any)("student_access")
          .update({ permissions: accessPerms }).eq("id", access.data.id);
      }

      const reused = res.data.reused || false;
      const reactivated = res.data.reactivated || false;
      
      let successMsg = res.data.message || "Acesso do aluno criado com sucesso!";
      if (reactivated) {
        successMsg = "Acesso do aluno reativado com sucesso!";
      } else if (reused && !reactivated) {
        successMsg = "Acesso do aluno já estava ativo.";
      }
      
      toast({ title: successMsg });
      setAccessEmail(""); 
      setAccessPassword("");
      setAccessPerms({
        view_hours: true,
        view_schedule: true,
        view_history: true,
        view_absences: true,
        view_financial: false,
        view_payments: false,
      });
      loadAll();
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido ao criar acesso";
      console.error("Student access error:", err);
      toast({ title: "Erro ao criar acesso", description: errorMsg, variant: "destructive" });
    }
    setAccessLoading(false);
  };

  const toggleStudentAccess = async (studentId: string, active: boolean) => {
    const record = accessRecords[studentId];
    if (!record) return;
    await (supabase.from as any)("student_access")
      .update({ is_active: active }).eq("id", record.id);
    toast({ title: active ? "Acesso reativado" : "Acesso desativado" });
    loadAll();
  };

  const updatePermissions = async (studentId: string, perms: Record<string, boolean>) => {
    const record = accessRecords[studentId];
    if (!record) return;
    await (supabase.from as any)("student_access")
      .update({ permissions: perms }).eq("id", record.id);
    toast({ title: "Permissões atualizadas" });
    setEditingAccessPerms(false);
    loadAll();
  };

  const resetStudentPassword = async (userId: string) => {
    if (!newAccessPassword) {
      toast({ title: "Nova senha é obrigatória", variant: "destructive" });
      return;
    }
    if (newAccessPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    
    setAccessLoading(true);
    try {
      const res = await supabase.functions.invoke("reset-student-password", {
        body: { user_id: userId, new_password: newAccessPassword },
      });
      
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Erro ao redefinir senha");
      }
      
      toast({ title: "Senha redefinida com sucesso" });
      setNewAccessPassword("");
      setEditingAccessPassword(false);
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro ao redefinir senha", description: err.message, variant: "destructive" });
    }
    setAccessLoading(false);
  };

  const packageValue = numVal(form.package_value);
  const packageMinutes = parseHoursToMinutes(String(form.package_hours));
  const packageHours = packageMinutes / 60;
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
    setIsLoading(true);
    try {
      const studentData = {
        name: form.name, phone: form.phone, email: form.email,
        subject: form.subject, modality: form.modality, notes: form.notes,
        status: form.status, guardian_name: "", guardian_phone: "",
        lesson_content: "", 
        enrollment_type: form.enrollment_type,
        hourly_rate: form.enrollment_type === "avulsa" ? numVal(form.hourly_rate) : hourlyRate,
      };

      if (editing) {
        await supabase.from("students").update(studentData).eq("id", editing.id);

        if (editingPackage) {
          const activePkg = getActivePackage(editing.id);
          if (activePkg) {
            const newHourlyRate = packageMinutes > 0 && finalValue > 0 ? finalValue / (packageMinutes / 60) : 0;
            await supabase.from("packages").update({
              name: `Pacote ${formatMinutesToHoursInput(packageMinutes)}`, hours_total: packageMinutes / 60,
              total_value: finalValue, hourly_rate: Math.round(newHourlyRate * 100) / 100,
            }).eq("id", activePkg.id);
            await supabase.from("students").update({ hours_contracted: packageMinutes / 60 }).eq("id", editing.id);
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
          .insert({ ...studentData, teacher_id: user!.id, hours_contracted: form.enrollment_type === "pacote" ? packageHours : 0, hours_remaining: form.enrollment_type === "pacote" ? packageHours : 0 })
          .select().single();
        if (error || !newStudent) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }

        if (form.enrollment_type === "pacote" && packageMinutes > 0) {
          const { data: newPkg } = await supabase.from("packages").insert({
            teacher_id: user!.id, student_id: newStudent.id,
            name: `Pacote ${formatMinutesToHoursInput(packageMinutes)}`, hours_total: packageHours,
            hours_used: 0, total_value: finalValue,
            hourly_rate: Math.round((finalValue / packageHours) * 100) / 100,
            expires_at: null, status: "ativo",
          }).select().single();

          if (finalValue > 0) await createPayments(newStudent.id, newPkg?.id || null);
        }
        toast({ title: "Aluno cadastrado com sucesso!" });
      }
      setDialogOpen(false); setEditing(null); setEditingPackage(false); setEditingFinancial(false); setForm(emptyForm); loadAll();
    } catch (error) {
      console.error("Error saving student:", error);
      toast({ title: "Erro ao salvar aluno", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
    setIsDeleting(true);
    try {
      await supabase.from("payments").delete().eq("student_id", id);
      await supabase.from("lessons").delete().eq("student_id", id);
      await supabase.from("packages").delete().eq("student_id", id);
      await supabase.from("students").delete().eq("id", id);
      toast({ title: "Aluno excluído" }); 
      loadAll();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast({ title: "Erro ao excluir aluno", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setStudentToDelete(null);
    }
  };

  const openEdit = (student: Student) => {
    const activePkg = getActivePackage(student.id);
    const stuPayments = getStudentPayments(student.id);
    setEditing(student); setEditingPackage(false); setEditingFinancial(false);
    setForm({
      name: student.name, phone: student.phone, email: student.email,
      subject: student.subject, modality: student.modality, notes: student.notes, status: student.status,
      enrollment_type: student.enrollment_type || "pacote",
      hourly_rate: student.enrollment_type === "avulsa" ? student.hourly_rate : "",
      package_hours: activePkg ? formatMinutesToHoursInput(activePkg.hours_total * 60) : "",
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

  const getStudentPackages = (studentId: string) => packages[studentId] || [];

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

  const loadStudentLessons = async (studentId: string) => {
    const { data } = await supabase
      .from("lessons")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("time", { ascending: false });
    
    const lessons = data || [];
    setStudentLessons(lessons);

    const summary = lessons.reduce((acc, l) => {
      if (l.lesson_type === "avulsa") {
        acc.avulsaCount++;
        const amount = Number(l.amount) || 0;
        if (l.payment_status === "pago") {
          acc.avulsaPaid += amount;
        } else {
          acc.avulsaPending += amount;
        }
      } else {
        if (l.status === "concluida" || l.status === "noshow") {
          acc.packageHoursConsumed += Number(l.duration) || 0;
        }
      }
      return acc;
    }, {
      packageHoursConsumed: 0,
      avulsaCount: 0,
      avulsaPaid: 0,
      avulsaPending: 0
    });
    
    setStudentLessonsSummary(summary);
  };

  const openSummary = (student: Student) => {
    setSummaryStudent(student);
    loadStudentLessons(student.id);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "realizada": return "bg-green-100 text-green-700 border-green-200";
      case "no-show": return "bg-red-100 text-red-700 border-red-200";
      case "agendada": return "bg-blue-100 text-blue-700 border-blue-200";
      case "remarcada": return "bg-orange-100 text-orange-700 border-orange-200";
      case "cancelada": return "bg-gray-100 text-gray-700 border-gray-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };


  const statusBadge = (s: string) =>
    s === "ativo" ? "bg-accent/10 text-accent border-accent/30" :
    s === "pausado" ? "bg-warning/10 text-warning border-warning/30" :
    "bg-muted text-muted-foreground border-border";

  const showPackageFields = (!editing || editingPackage) && form.enrollment_type === "pacote";
  const showPaymentFields = (!editing || editingFinancial) && finalValue > 0 && form.enrollment_type === "pacote";

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

              {/* Enrollment Type */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tipo de Contratação</legend>
                <div className="space-y-1.5">
                  <Select value={form.enrollment_type} onValueChange={v => setForm({ ...form, enrollment_type: v })}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pacote">Pacote de horas</SelectItem>
                      <SelectItem value="avulsa">Aula avulsa</SelectItem>
                      <SelectItem value="sem_pacote">Sem pacote definido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.enrollment_type === "avulsa" && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-xs font-medium">Valor da Aula Avulsa (R$)</Label>
                    <Input type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} className="h-10 rounded-xl" placeholder="0,00" />
                  </div>
                )}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Horas Contratadas</Label>
                      <Input 
                        value={form.package_hours} 
                        onChange={e => setForm({ ...form, package_hours: e.target.value })} 
                        className="h-10 rounded-xl" 
                        placeholder="Ex: 10h ou 10h30" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Valor do Pacote (R$)</Label>
                      <Input type="number" value={form.package_value} onChange={e => setForm({ ...form, package_value: e.target.value })} className="h-10 rounded-xl" placeholder="0,00" />
                    </div>
                  </div>
                  {packageMinutes > 0 && packageValue > 0 && (
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

              <Button onClick={handleSave} disabled={isLoading} className="w-full h-11 rounded-xl font-semibold text-sm">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  editing ? "Salvar Alterações" : "Cadastrar Aluno"
                )}
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
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.subject?.trim() ? s.subject : "Disciplina não informada"} · {s.modality}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusBadge(s.status)}`}>{s.status}</Badge>
                  </div>

                  {activePkg ? (
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
                  ) : (
                    <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center">
                      <p className="text-[11px] font-semibold text-foreground flex items-center justify-center gap-1">
                        <Package className="h-3 w-3" /> Sem pacote ativo
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        Adicione um novo pacote ou agende uma aula avulsa.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 mt-2 text-[11px] rounded-lg gap-1"
                        onClick={() => setNewPkgStudent(s)}
                      >
                        <Plus className="h-3 w-3" /> Pacote
                      </Button>
                    </div>
                  )}

                  {activePkg && (
                    <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                      <Package className="h-3 w-3" /> {activePkg.name} · R$ {activePkg.total_value.toFixed(2)}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {s.phone?.trim() ? s.phone : <span className="italic">Telefone não informado</span>}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg text-primary hover:bg-primary/10 gap-1" onClick={() => setDetailStudent(s)}>
                        <Eye className="h-3.5 w-3.5" /> Detalhes
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg text-accent hover:bg-accent/10 gap-1" onClick={() => openSummary(s)}>
                        <FileText className="h-3.5 w-3.5" /> Resumo
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg text-primary hover:bg-primary/10 gap-1" onClick={() => setNewPkgStudent(s)}>
                        <Package className="h-3.5 w-3.5" /> Pacote
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label="Editar aluno" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10" onClick={() => openEdit(s)}>
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Excluir aluno" className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10" onClick={() => setStudentToDelete(s.id)}>
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

      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o aluno
              e todos os seus dados vinculados (pagamentos, aulas e pacotes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (studentToDelete) handleDelete(studentToDelete);
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</>
              ) : (
                "Confirmar Exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onOpenChange={(open) => {
        if (!open) {
          setDetailStudent(null);
          setAccessEmail("");
          setAccessPassword("");
          setNewAccessPassword("");
          setEditingAccessPerms(false);
          setEditingAccessPassword(false);
        }
      }}>
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

                {detailStudent.enrollment_type === "pacote" && activePkg && (
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

                {detailStudent.enrollment_type === "avulsa" && (
                  <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 space-y-2">
                    <h3 className="text-[11px] font-bold text-accent uppercase tracking-widest">Aula Avulsa</h3>
                    <div className="flex justify-between items-center">
                      <p className="text-sm">Valor por aula:</p>
                      <p className="text-lg font-bold text-accent">R$ {(detailStudent.hourly_rate || 0).toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {detailStudent.enrollment_type === "sem_pacote" && (
                  <div className="p-4 rounded-xl bg-muted border border-border/40 text-center">
                    <p className="text-sm font-medium text-muted-foreground italic">Nenhum pacote definido</p>
                  </div>
                )}

                {/* Histórico de pacotes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Package className="h-3 w-3" /> Histórico de pacotes
                    </h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1"
                      onClick={() => { setNewPkgStudent(detailStudent); }}>
                      <Plus className="h-3 w-3" /> Novo pacote
                    </Button>
                  </div>
                  <PackageHistory
                    studentId={detailStudent.id}
                    studentName={detailStudent.name}
                    packages={getStudentPackages(detailStudent.id) as any}
                    onChanged={loadAll}
                  />
                </div>

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

                {/* Student Access Section */}
                {(() => {
                  const access = accessRecords[detailStudent.id];
                  const permLabels: { key: string; label: string }[] = [
                    { key: "view_hours", label: "Ver horas do pacote" },
                    { key: "view_schedule", label: "Ver próximas aulas" },
                    { key: "view_history", label: "Ver histórico de aulas" },
                    { key: "view_absences", label: "Ver faltas e no-show" },
                    { key: "view_financial", label: "Ver financeiro" },
                    { key: "view_payments", label: "Ver pagamentos e parcelas" },
                  ];

                  if (access) {
                    const perms = access.permissions as any;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                            <KeyRound className="h-3 w-3" /> Acesso do Aluno
                          </h3>
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${access.is_active ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                            {access.is_active ? "Ativo" : "Desativado"}
                          </Badge>
                        </div>
                        
                        {/* Email do Acesso */}
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">E-mail de Acesso</p>
                          <p className="text-sm font-medium text-foreground break-all">{access.id === "" ? "—" : "***@***.com"}</p>
                        </div>
                        
                        {!editingAccessPerms && (
                          <div className="space-y-2">
                            {permLabels.slice(0, 3).map(p => (
                              <div key={p.key} className="flex items-center justify-between py-1">
                                <span className="text-xs">{p.label}</span>
                                <div className="h-4 w-4 rounded border border-border flex items-center justify-center">
                                  {!!perms[p.key] && <div className="h-2.5 w-2.5 bg-accent rounded-sm" />}
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={() => setEditingAccessPerms(!editingAccessPerms)}
                              className="text-[11px] text-accent hover:text-accent/80 font-medium mt-2"
                            >
                              Ver todas as permissões →
                            </button>
                          </div>
                        )}
                        
                        {editingAccessPerms && (
                          <div className="space-y-2 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            {permLabels.map(p => (
                              <div key={p.key} className="flex items-center justify-between py-1">
                                <span className="text-xs">{p.label}</span>
                                <Switch
                                  checked={!!perms[p.key]}
                                  onCheckedChange={(checked) => {
                                    const newPerms = { ...perms, [p.key]: checked };
                                    updatePermissions(detailStudent.id, newPerms);
                                  }}
                                  disabled={accessLoading}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {editingAccessPassword && (
                          <div className="space-y-2 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <Input
                              type="password"
                              placeholder="Nova senha (mín. 6 caracteres)"
                              value={newAccessPassword}
                              onChange={e => setNewAccessPassword(e.target.value)}
                              className="h-8 rounded-lg text-sm"
                              disabled={accessLoading}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-8 rounded-lg text-xs"
                                disabled={accessLoading || newAccessPassword.length < 6}
                                onClick={() => resetStudentPassword(access.user_id)}
                              >
                                {accessLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Redefinindo...</> : "Redefinir"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 rounded-lg text-xs"
                                disabled={accessLoading}
                                onClick={() => {
                                  setEditingAccessPassword(false);
                                  setNewAccessPassword("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-2 pt-2">
                          {!editingAccessPassword && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9 rounded-xl text-xs gap-1"
                              disabled={accessLoading}
                              onClick={() => setEditingAccessPassword(!editingAccessPassword)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Redefinir Senha
                            </Button>
                          )}
                          <Button
                            variant={access.is_active ? "destructive" : "default"}
                            size="sm"
                            className="w-full h-9 rounded-xl text-xs gap-1"
                            disabled={accessLoading}
                            onClick={() => toggleStudentAccess(detailStudent.id, !access.is_active)}
                          >
                            {access.is_active ? <><ShieldOff className="h-3.5 w-3.5" /> Desativar Acesso</> : <><ShieldCheck className="h-3.5 w-3.5" /> Reativar Acesso</>}
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/40">
                      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <KeyRound className="h-3 w-3" /> Criar Acesso do Aluno
                      </h3>
                      <p className="text-xs text-muted-foreground">Crie uma conta para o aluno acessar o portal com informações das aulas e pacotes.</p>
                      <div className="space-y-2">
                        <Input
                          type="email" placeholder="E-mail do aluno"
                          value={accessEmail} onChange={e => setAccessEmail(e.target.value)}
                          className="h-9 rounded-xl text-sm"
                        />
                        <Input
                          type="password" placeholder="Senha (mín. 6 caracteres)"
                          value={accessPassword} onChange={e => setAccessPassword(e.target.value)}
                          className="h-9 rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Permissões</p>
                        {permLabels.map(p => (
                          <div key={p.key} className="flex items-center justify-between py-0.5">
                            <span className="text-xs">{p.label}</span>
                            <Switch
                              checked={!!(accessPerms as any)[p.key]}
                              onCheckedChange={(checked) => setAccessPerms(prev => ({ ...prev, [p.key]: checked }))}
                            />
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm" className="w-full h-9 rounded-xl text-xs gap-1"
                        disabled={accessLoading}
                        onClick={() => createStudentAccess(detailStudent.id, detailStudent.name)}
                      >
                        {accessLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando...</> : <><KeyRound className="h-3.5 w-3.5" /> Criar Acesso</>}
                      </Button>
                    </div>
                  );
                })()}

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

      {/* Student Summary Dialog */}
      <Dialog open={!!summaryStudent} onOpenChange={() => setSummaryStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Resumo Operacional: {summaryStudent?.name}</DialogTitle>
          </DialogHeader>
          {summaryStudent && (() => {
            const info = getHoursInfo(summaryStudent.id);
            const activePkg = getActivePackage(summaryStudent.id);
            const allPkgs = getStudentPackages(summaryStudent.id);
            const sortedPkgs = [...allPkgs].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
            const lastClosedPkg = sortedPkgs.find((p) => p.status !== "ativo") || null;
            const primaryPkg: StudentPackage | null = activePkg || lastClosedPkg;
            const primaryHoursMin = primaryPkg ? primaryPkg.hours_total * 60 : 0;
            const primaryUsedMin = primaryPkg ? primaryPkg.hours_used : 0;
            const primaryRemainMin = primaryHoursMin - primaryUsedMin;
            const excessMin = primaryPkg ? Math.max(0, primaryUsedMin - primaryHoursMin) : 0;
            const pctPrimary = primaryHoursMin > 0 ? Math.min(100, Math.round((primaryUsedMin / primaryHoursMin) * 100)) : 0;

            return (
              <div className="space-y-6 py-2">
                {/* Empty state — no packages at all */}
                {allPkgs.length === 0 && summaryStudent.enrollment_type === "pacote" && (
                  <div className="p-6 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-3">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">Este aluno ainda não possui pacote cadastrado.</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button size="sm" className="rounded-lg gap-1" onClick={() => setNewPkgStudent(summaryStudent)}>
                        <Plus className="h-3.5 w-3.5" /> Adicionar pacote
                      </Button>
                    </div>
                  </div>
                )}

                {/* Closed-package banner */}
                {!activePkg && lastClosedPkg && (
                  <div className="p-3 rounded-xl border border-warning/30 bg-warning/5 text-xs text-warning font-medium">
                    Este aluno não possui pacote ativo no momento. Exibindo dados do último pacote ({statusLabel(lastClosedPkg.status)}).
                  </div>
                )}

                {/* Excess alert */}
                {excessMin > 0 && primaryPkg && (
                  <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-bold text-destructive">
                        Excesso de {formatHoursDisplay(excessMin)} consumidas no pacote {activePkg ? "" : "anterior "}({primaryPkg.name}).
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {activePkg
                          ? "Você pode transferir as aulas excedentes para o pacote ativo."
                          : "Crie um novo pacote ativo para transferir as aulas excedentes."}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg gap-1 mt-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={!activePkg}
                        onClick={() => activePkg && setExcessTransfer({ source: primaryPkg as any, dest: activePkg as any, student: summaryStudent })}
                      >
                        <ArrowRightLeft className="h-3 w-3" /> Corrigir excesso
                      </Button>
                    </div>
                  </div>
                )}

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Tipo de Contrato</p>
                    <p className="text-sm font-bold capitalize">
                      {summaryStudent.enrollment_type === "pacote" ? "Pacote de horas" : 
                       summaryStudent.enrollment_type === "avulsa" ? "Aula avulsa" : "Sem pacote"}
                    </p>
                  </div>
                  {summaryStudent.enrollment_type === "pacote" && primaryPkg ? (
                    <>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                          {activePkg ? "Total do Pacote" : "Último Pacote"}
                        </p>
                        <p className="text-lg font-bold text-primary">{formatHoursDisplay(primaryHoursMin)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Consumidas</p>
                        <p className={`text-lg font-bold ${excessMin > 0 ? "text-destructive" : "text-green-600"}`}>
                          {formatHoursDisplay(primaryUsedMin)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                          {excessMin > 0 ? "Excesso" : "Saldo Restante"}
                        </p>
                        <p className={`text-lg font-bold ${excessMin > 0 ? "text-destructive" : "text-accent"}`}>
                          {excessMin > 0 ? formatHoursDisplay(excessMin) : formatHoursDisplay(Math.max(0, primaryRemainMin))}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Valor/Aula</p>
                        <p className="text-lg font-bold text-primary">R$ {(summaryStudent.hourly_rate || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Aulas Avulsas</p>
                        <p className="text-lg font-bold text-green-600">{studentLessonsSummary.avulsaCount}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Status Aluno</p>
                        <p className="text-sm font-bold uppercase">{summaryStudent.status}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-accent/5 border border-accent/20">
                    <p className="text-[10px] text-accent uppercase font-bold tracking-wider mb-1">Pagos (Avulsas)</p>
                    <p className="text-lg font-bold text-accent">R$ {studentLessonsSummary.avulsaPaid.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                    <p className="text-[10px] text-warning uppercase font-bold tracking-wider mb-1">Pendentes (Avulsas)</p>
                    <p className="text-lg font-bold text-warning">R$ {studentLessonsSummary.avulsaPending.toFixed(2)}</p>
                  </div>
                </div>

                {/* Package Progress */}
                {primaryPkg && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {activePkg ? "Pacote ativo: " : "Último pacote: "}{primaryPkg.name}
                        <Badge variant="outline" className={`ml-1 text-[9px] h-4 px-1 ${statusBadgeClasses(primaryPkg.status)}`}>
                          {statusLabel(primaryPkg.status)}
                        </Badge>
                      </h3>
                      <span className="text-[11px] font-medium">{pctPrimary}% consumido</span>
                    </div>
                    <Progress value={pctPrimary} className="h-3" />
                  </div>
                )}

                {/* Histórico de pacotes do aluno */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Package className="h-3 w-3" /> Histórico de pacotes
                    </h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1"
                      onClick={() => setNewPkgStudent(summaryStudent)}>
                      <Plus className="h-3 w-3" /> Novo pacote
                    </Button>
                  </div>
                  <PackageHistory
                    studentId={summaryStudent.id}
                    studentName={summaryStudent.name}
                    packages={getStudentPackages(summaryStudent.id) as any}
                    onChanged={loadAll}
                  />
                </div>

                {/* Lesson History */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Histórico de Aulas
                  </h3>
                  
                  {studentLessons.length === 0 ? (
                    <div className="py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">Nenhuma aula registrada.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden sm:block border rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3 font-bold">Data</th>
                              <th className="px-4 py-3 font-bold">Início</th>
                              <th className="px-4 py-3 font-bold">Fim</th>
                              <th className="px-4 py-3 font-bold">Duração</th>
                              <th className="px-4 py-3 font-bold">Tipo</th>
                              <th className="px-4 py-3 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {studentLessons.map((lesson) => {
                              const endTime = lesson.end_time || calculateEndTime(lesson.time, lesson.duration);
                              return (
                                <tr key={lesson.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">{format(new Date(lesson.date + "T12:00:00"), "dd/MM/yyyy")}</td>
                                  <td className="px-4 py-3">{lesson.time}</td>
                                  <td className="px-4 py-3">{endTime}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{formatHoursDisplay(lesson.duration)}</td>
                                  <td className="px-4 py-3">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {lesson.lesson_type === "avulsa" ? "Avulsa" : "Pacote"}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-none ${getStatusColor(lesson.status)}`}>
                                      {lesson.status}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile List */}
                      <div className="sm:hidden space-y-2">
                        {studentLessons.map((lesson) => {
                          const endTime = lesson.end_time || calculateEndTime(lesson.time, lesson.duration);
                          return (
                            <div key={lesson.id} className="p-3 rounded-xl bg-card border border-border/60 space-y-2">
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-bold">{format(new Date(lesson.date + "T12:00:00"), "dd/MM/yyyy")}</p>
                                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-none ${getStatusColor(lesson.status)}`}>
                                  {lesson.status}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <div>
                                  <span className="font-medium text-foreground">{lesson.time} — {endTime}</span>
                                  <span className="mx-2">•</span>
                                  <span>{formatHoursDisplay(lesson.duration)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Novo pacote dialog */}
      {newPkgStudent && user && (() => {
        const active = getActivePackage(newPkgStudent.id);
        const remaining = active ? Math.max(0, active.hours_total - active.hours_used) : 0;
        return (
          <NewPackageDialog
            open={!!newPkgStudent}
            onOpenChange={(v) => { if (!v) setNewPkgStudent(null); }}
            teacherId={user.id}
            studentId={newPkgStudent.id}
            studentName={newPkgStudent.name}
            hasActivePackage={!!active}
            activePackageRemainingHours={remaining}
            onCreated={loadAll}
          />
        );
      })()}

      {/* Transfer excess from summary */}
      {excessTransfer && (
        <TransferExcessDialog
          open={!!excessTransfer}
          onOpenChange={(v) => { if (!v) setExcessTransfer(null); }}
          sourcePkg={excessTransfer.source as any}
          destPkg={excessTransfer.dest as any}
          studentId={excessTransfer.student.id}
          studentName={excessTransfer.student.name}
          onChanged={() => { loadAll(); }}
        />
      )}
    </div>
  );
}
