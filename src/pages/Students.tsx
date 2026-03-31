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
import { Plus, Search, Edit, Trash2, Phone, Mail, User, BookOpen, Clock, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

const emptyStudent: Omit<Student, "id" | "teacher_id"> = {
  name: "", phone: "", email: "", guardian_name: "", guardian_phone: "",
  subject: "", lesson_content: "", modality: "online", hourly_rate: 0,
  notes: "", status: "ativo", hours_contracted: 0, hours_remaining: 0,
};

const PRESET_PACKAGES = [
  { label: "5 horas", hours: 5 },
  { label: "6 horas", hours: 6 },
  { label: "8 horas", hours: 8 },
  { label: "10 horas", hours: 10 },
  { label: "12 horas", hours: 12 },
  { label: "20 horas", hours: 20 },
];

export default function Students() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Record<string, StudentPackage[]>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyStudent);
  // Package dialog
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [pkgStudent, setPkgStudent] = useState<Student | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: "", hours_total: 0, total_value: 0, expires_at: "" });
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  useEffect(() => { if (user) { loadStudents(); } }, [user]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("*").eq("teacher_id", user!.id).order("name");
    setStudents(data || []);
    // Load packages for all students
    const { data: pkgs } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    const grouped: Record<string, StudentPackage[]> = {};
    (pkgs || []).forEach((p: any) => {
      if (!grouped[p.student_id]) grouped[p.student_id] = [];
      grouped[p.student_id].push(p);
    });
    setPackages(grouped);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (editing) {
      const { error } = await supabase.from("students").update(form).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aluno atualizado!" });
    } else {
      const { error } = await supabase.from("students").insert({ ...form, teacher_id: user!.id });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aluno cadastrado!" });
    }
    setDialogOpen(false); setEditing(null); setForm(emptyStudent); loadStudents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aluno e todos os seus pacotes?")) return;
    await supabase.from("students").delete().eq("id", id);
    toast({ title: "Aluno excluído" }); loadStudents();
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    const { id, teacher_id, ...rest } = student;
    setForm(rest); setDialogOpen(true);
  };

  const openNew = () => { setEditing(null); setForm(emptyStudent); setDialogOpen(true); };

  const openAddPackage = (student: Student) => {
    setPkgStudent(student);
    setPkgForm({ name: "", hours_total: 0, total_value: 0, expires_at: "" });
    setPkgDialogOpen(true);
  };

  const selectPreset = (hours: number) => {
    setPkgForm({ ...pkgForm, name: `Pacote ${hours}h`, hours_total: hours });
  };

  const handleSavePackage = async () => {
    if (!pkgStudent || pkgForm.hours_total <= 0) {
      toast({ title: "Defina as horas do pacote", variant: "destructive" }); return;
    }
    const hourlyRate = pkgForm.total_value > 0 ? pkgForm.total_value / pkgForm.hours_total : 0;
    const { error } = await supabase.from("packages").insert({
      teacher_id: user!.id,
      student_id: pkgStudent.id,
      name: pkgForm.name || `Pacote ${pkgForm.hours_total}h`,
      hours_total: pkgForm.hours_total,
      hours_used: 0,
      total_value: pkgForm.total_value,
      hourly_rate: Math.round(hourlyRate * 100) / 100,
      expires_at: pkgForm.expires_at || null,
      status: "ativo",
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    // Update student hours
    const studentPkgs = [...(packages[pkgStudent.id] || [])];
    const totalHours = studentPkgs.reduce((s, p) => s + (p.status === "ativo" ? p.hours_total - p.hours_used : 0), 0) + pkgForm.hours_total;
    const totalContracted = studentPkgs.reduce((s, p) => s + p.hours_total, 0) + pkgForm.hours_total;
    await supabase.from("students").update({ hours_remaining: totalHours, hours_contracted: totalContracted }).eq("id", pkgStudent.id);
    toast({ title: "Pacote criado!" });
    setPkgDialogOpen(false); loadStudents();
  };

  const getActivePackage = (studentId: string) => {
    return (packages[studentId] || []).find(p => p.status === "ativo");
  };

  const getHoursRemaining = (studentId: string) => {
    return (packages[studentId] || []).filter(p => p.status === "ativo").reduce((s, p) => s + (p.hours_total - p.hours_used), 0);
  };

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.subject?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusStyle = (s: string) =>
    s === "ativo" ? "bg-accent/10 text-accent border-accent/20" :
    s === "pausado" ? "bg-warning/10 text-warning border-warning/20" :
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
              <DialogTitle className="text-lg">{editing ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-3">
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Pessoais</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9" /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-medium">E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9" /></div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Responsável Financeiro</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Nome</Label><Input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Telefone</Label><Input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} className="h-9" /></div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Aula</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Disciplina</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Modalidade</Label>
                    <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="presencial">Presencial</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-medium">Conteúdo da aula</Label><Textarea value={form.lesson_content} onChange={e => setForm({ ...form, lesson_content: e.target.value })} rows={2} className="text-sm" /></div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="pausado">Pausado</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" /></div>
              <Button onClick={handleSave} className="w-full h-10 rounded-lg font-medium">{editing ? "Salvar Alterações" : "Cadastrar Aluno"}</Button>
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
            const hrs = getHoursRemaining(s.id);
            const activePkg = getActivePackage(s.id);
            const lowHours = hrs > 0 && hrs <= 2;
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
                        <p className="text-[11px] text-muted-foreground truncate">{s.subject || "Sem disciplina"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusStyle(s.status)}`}>{s.status}</Badge>
                  </div>

                  <div className="space-y-1.5 text-[12px] text-muted-foreground mb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {s.modality}</span>
                      {activePkg && (
                        <span className={`flex items-center gap-1 ${lowHours ? "text-destructive font-medium" : ""}`}>
                          <Clock className="h-3 w-3" /> {hrs}h restantes
                          {lowHours && <AlertTriangle className="h-3 w-3" />}
                        </span>
                      )}
                    </div>
                    {activePkg && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{activePkg.name} · R$ {activePkg.hourly_rate.toFixed(2)}/h</span>
                      </div>
                    )}
                    {s.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}
                  </div>

                  {/* Hours progress bar */}
                  {activePkg && (
                    <div className="mb-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${lowHours ? "bg-destructive" : "bg-accent"}`}
                          style={{ width: `${Math.min(100, ((activePkg.hours_total - activePkg.hours_used + (hrs - (activePkg.hours_total - activePkg.hours_used))) / (activePkg.hours_total || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary hover:bg-primary/10" onClick={() => openAddPackage(s)}>
                      <Package className="h-3 w-3 mr-1" /> Pacote
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10" onClick={() => { setDetailStudent(s); }}>
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
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

      {/* Package Dialog */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Pacote — {pkgStudent?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-3">
            <div>
              <Label className="text-xs font-medium mb-2 block">Pacotes pré-definidos</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_PACKAGES.map(p => (
                  <button key={p.hours} onClick={() => selectPreset(p.hours)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${pkgForm.hours_total === p.hours ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary/40"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium">Horas</Label><Input type="number" value={pkgForm.hours_total || ""} onChange={e => setPkgForm({ ...pkgForm, hours_total: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">Valor Total (R$)</Label><Input type="number" value={pkgForm.total_value || ""} onChange={e => setPkgForm({ ...pkgForm, total_value: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
            </div>
            {pkgForm.hours_total > 0 && pkgForm.total_value > 0 && (
              <p className="text-xs text-muted-foreground">Valor por hora: <span className="font-semibold text-foreground">R$ {(pkgForm.total_value / pkgForm.hours_total).toFixed(2)}</span></p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium">Nome (opcional)</Label><Input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} className="h-9" placeholder={`Pacote ${pkgForm.hours_total}h`} /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">Validade</Label><Input type="date" value={pkgForm.expires_at} onChange={e => setPkgForm({ ...pkgForm, expires_at: e.target.value })} className="h-9" /></div>
            </div>
            <Button onClick={handleSavePackage} className="h-10 rounded-lg">Criar Pacote</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onOpenChange={() => setDetailStudent(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailStudent?.name}</DialogTitle></DialogHeader>
          {detailStudent && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Disciplina</p><p className="font-medium">{detailStudent.subject || "—"}</p></div>
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Modalidade</p><p className="font-medium">{detailStudent.modality}</p></div>
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Telefone</p><p className="font-medium">{detailStudent.phone || "—"}</p></div>
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">E-mail</p><p className="font-medium">{detailStudent.email || "—"}</p></div>
              </div>
              {detailStudent.guardian_name && (
                <div className="text-sm">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Responsável</p>
                  <p className="font-medium">{detailStudent.guardian_name} {detailStudent.guardian_phone && `· ${detailStudent.guardian_phone}`}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pacotes</h3>
                {(packages[detailStudent.id] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pacote registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {(packages[detailStudent.id] || []).map(pkg => (
                      <div key={pkg.id} className="p-3 rounded-lg bg-muted/50 border border-border/40">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{pkg.name}</span>
                          <Badge variant="outline" className={`text-[10px] h-5 ${pkg.status === "ativo" ? "bg-accent/10 text-accent border-accent/20" : "bg-muted text-muted-foreground"}`}>{pkg.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{pkg.hours_used}h / {pkg.hours_total}h usadas</span>
                          <span>R$ {pkg.total_value.toFixed(2)}</span>
                          {pkg.expires_at && <span>Vence: {pkg.expires_at}</span>}
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                          <div className={`h-full rounded-full ${pkg.hours_used / pkg.hours_total > 0.8 ? "bg-destructive" : "bg-accent"}`}
                            style={{ width: `${Math.min(100, (1 - pkg.hours_used / (pkg.hours_total || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
