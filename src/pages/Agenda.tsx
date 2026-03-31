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
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Edit, Trash2, X, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "day" | "week" | "month";

interface Lesson {
  id: string; student_id: string; teacher_id: string; date: string;
  time: string; duration: number; subject: string; status: string;
  notes: string; modality: string; package_id: string | null;
  students?: { name: string };
}

interface Student { id: string; name: string; subject: string; modality: string; }
interface StudentPackage { id: string; student_id: string; name: string; hours_total: number; hours_used: number; status: string; }

export default function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<StudentPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({
    student_id: "", date: format(new Date(), "yyyy-MM-dd"), time: "08:00",
    duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "",
  });

  useEffect(() => { if (user) { loadLessons(); loadStudents(); loadPackages(); } }, [user, currentDate, view]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("id,name,subject,modality").eq("teacher_id", user!.id);
    setStudents(data || []);
  };

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).eq("status", "ativo");
    setPackages(data || []);
  };

  const loadLessons = async () => {
    let start: string, end: string;
    if (view === "day") { start = format(currentDate, "yyyy-MM-dd"); end = start + "T23:59:59"; }
    else if (view === "week") {
      start = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      end = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd") + "T23:59:59";
    } else {
      start = format(startOfMonth(currentDate), "yyyy-MM-dd");
      end = format(endOfMonth(currentDate), "yyyy-MM-dd") + "T23:59:59";
    }
    const { data } = await supabase.from("lessons").select("*, students(name)")
      .eq("teacher_id", user!.id).gte("date", start).lte("date", end).order("date").order("time");
    setLessons(data || []);
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const handleSave = async () => {
    if (!form.student_id) { toast({ title: "Selecione um aluno", variant: "destructive" }); return; }
    const payload: any = { ...form, teacher_id: user!.id, package_id: form.package_id || null };
    if (editing) {
      await supabase.from("lessons").update(payload).eq("id", editing.id);
      toast({ title: "Aula atualizada!" });
    } else {
      await supabase.from("lessons").insert(payload);
      toast({ title: "Aula agendada!" });
    }
    setDialogOpen(false); setEditing(null); loadLessons();
  };

  const updateStatus = async (id: string, status: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;

    // Auto-deduct hours when completing or marking absence
    if ((status === "concluida" || status === "falta") && lesson.status === "agendada") {
      const pkg = lesson.package_id
        ? packages.find(p => p.id === lesson.package_id)
        : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");

      if (pkg) {
        const newUsed = pkg.hours_used + lesson.duration;
        const newStatus = newUsed >= pkg.hours_total ? "concluido" : "ativo";
        await supabase.from("packages").update({ hours_used: newUsed, status: newStatus }).eq("id", pkg.id);

        // Update student hours_remaining
        const { data: studentPkgs } = await supabase.from("packages").select("*").eq("student_id", lesson.student_id).eq("status", "ativo");
        const remaining = (studentPkgs || []).reduce((s, p) => s + (p.hours_total - p.hours_used), 0) - lesson.duration;
        await supabase.from("students").update({ hours_remaining: Math.max(0, remaining) }).eq("id", lesson.student_id);

        if (status === "falta") {
          toast({ title: "Falta registrada", description: `${lesson.duration}h descontada do pacote (ausência sem aviso)` });
        } else {
          toast({ title: "Aula concluída!", description: `${lesson.duration}h descontada do pacote` });
        }
        loadPackages();
      } else {
        toast({ title: status === "falta" ? "Falta registrada" : "Aula concluída!" });
      }
    } else {
      toast({ title: `Aula: ${status}` });
    }

    await supabase.from("lessons").update({ status }).eq("id", id);
    loadLessons();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    toast({ title: "Aula excluída" }); loadLessons();
  };

  const openEdit = (lesson: Lesson) => {
    setEditing(lesson);
    setForm({
      student_id: lesson.student_id, date: lesson.date?.split("T")[0] || "",
      time: lesson.time, duration: lesson.duration, subject: lesson.subject,
      status: lesson.status, notes: lesson.notes || "", modality: lesson.modality || "online",
      package_id: lesson.package_id || "",
    });
    setDialogOpen(true);
  };

  const openNew = (date?: string) => {
    setEditing(null);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time: "08:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "" });
    setDialogOpen(true);
  };

  const getStudentPackages = (studentId: string) => packages.filter(p => p.student_id === studentId);

  const getLessonsForDay = (date: Date) => lessons.filter(l => isSameDay(new Date(l.date), date));

  const statusStyle = (s: string) => {
    const m: Record<string, string> = {
      agendada: "bg-primary/10 text-primary border-primary/20",
      concluida: "bg-accent/10 text-accent border-accent/20",
      cancelada: "bg-destructive/10 text-destructive border-destructive/20",
      falta: "bg-warning/10 text-warning border-warning/20",
      reposicao: "bg-info/10 text-info border-info/20",
    };
    return m[s] || "bg-muted text-muted-foreground";
  };

  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {days.map(day => {
          const dl = getLessonsForDay(day);
          return (
            <div key={day.toISOString()} className={`card-premium p-2.5 min-h-[100px] ${isToday(day) ? "ring-1 ring-primary/30" : ""}`}>
              <div className="text-center mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-bold leading-tight ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</p>
              </div>
              <div className="space-y-1">
                {dl.map(lesson => (
                  <div key={lesson.id} onClick={() => openEdit(lesson)} className={`p-1.5 rounded-md text-[11px] cursor-pointer hover:opacity-80 transition-opacity ${statusStyle(lesson.status)}`}>
                    <p className="font-semibold truncate">{lesson.students?.name}</p>
                    <p className="opacity-70">{lesson.time}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => openNew(format(day, "yyyy-MM-dd"))} className="text-[11px] text-muted-foreground/50 hover:text-primary w-full text-center mt-1.5 transition-colors">+ aula</button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayLessons = getLessonsForDay(currentDate);
    return (
      <div className="space-y-2.5 max-w-2xl">
        {dayLessons.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma aula neste dia.</p>
          </div>
        ) : dayLessons.map(lesson => (
          <Card key={lesson.id} className="card-premium hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="text-center shrink-0 pt-0.5">
                    <p className="text-base font-bold text-primary leading-none">{lesson.time}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{lesson.duration}h</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{lesson.students?.name}</p>
                    <p className="text-xs text-muted-foreground">{lesson.subject}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${statusStyle(lesson.status)}`}>{lesson.status}</Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-3 w-3" />{lesson.modality}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {lesson.status === "agendada" && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-accent hover:bg-accent/10" onClick={() => updateStatus(lesson.id, "concluida")} title="Concluir"><Check className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-warning hover:bg-warning/10" onClick={() => updateStatus(lesson.id, "falta")} title="Falta"><AlertTriangle className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-info hover:bg-info/10" onClick={() => updateStatus(lesson.id, "reposicao")} title="Reposição"><RotateCcw className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => updateStatus(lesson.id, "cancelada")} title="Cancelar"><X className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={() => openEdit(lesson)}><Edit className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderMonthView = () => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const monthStart = startOfWeek(ms, { weekStartsOn: 1 });
    const monthEnd = endOfWeek(me, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
            <div key={d} className="text-[10px] text-center text-muted-foreground font-semibold uppercase tracking-wider py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dl = getLessonsForDay(day);
            const inMonth = day.getMonth() === currentDate.getMonth();
            return (
              <div key={day.toISOString()} onClick={() => { setCurrentDate(day); setView("day"); }}
                className={`card-premium p-1.5 min-h-[56px] cursor-pointer hover:shadow-sm transition-all ${isToday(day) ? "ring-1 ring-primary/30" : ""} ${!inMonth ? "opacity-25" : ""}`}>
                <p className={`text-[11px] text-right font-medium ${isToday(day) ? "text-primary font-bold" : ""}`}>{format(day, "d")}</p>
                {dl.slice(0, 2).map(l => (
                  <div key={l.id} className={`text-[9px] rounded px-1 py-0.5 mt-0.5 truncate font-medium ${statusStyle(l.status)}`}>{l.students?.name}</div>
                ))}
                {dl.length > 2 && <p className="text-[9px] text-muted-foreground text-center mt-0.5">+{dl.length - 2}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-title">Agenda</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openNew()} size="sm" className="rounded-lg shadow-sm"><Plus className="h-4 w-4 mr-1.5" /> Nova Aula</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-lg">{editing ? "Editar Aula" : "Agendar Aula"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Aluno *</Label>
                <Select value={form.student_id} onValueChange={v => {
                  const st = students.find(s => s.id === v);
                  const stPkgs = getStudentPackages(v);
                  setForm({ ...form, student_id: v, subject: st?.subject || form.subject, modality: st?.modality || form.modality, package_id: stPkgs.length > 0 ? stPkgs[0].id : "" });
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.student_id && getStudentPackages(form.student_id).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pacote</Label>
                  <Select value={form.package_id} onValueChange={v => setForm({ ...form, package_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {getStudentPackages(form.student_id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.hours_total - p.hours_used}h restantes)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium">Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium">Horário</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="h-9" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium">Duração (h)</Label><Input type="number" step="0.5" value={form.duration} onChange={e => setForm({ ...form, duration: parseFloat(e.target.value) || 1 })} className="h-9" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                      <SelectItem value="falta">Falta</SelectItem>
                      <SelectItem value="reposicao">Reposição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium">Disciplina</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-9" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Modalidade</Label>
                  <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="presencial">Presencial</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" /></div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1 h-10 rounded-lg">{editing ? "Salvar" : "Agendar"}</Button>
                {editing && <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive h-10 rounded-lg"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold min-w-[160px] text-center text-foreground">
            {view === "day" && format(currentDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            {view === "week" && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")}`}
            {view === "month" && format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {view === "day" && renderDayView()}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}
    </div>
  );
}
