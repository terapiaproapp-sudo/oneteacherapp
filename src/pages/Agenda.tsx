import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Trash2, Check, RotateCcw, AlertTriangle, Package, X as XIcon, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lesson {
  id: string; student_id: string; teacher_id: string; date: string;
  time: string; duration: number; subject: string; status: string;
  notes: string; modality: string; package_id: string | null;
  students?: { name: string };
}
interface Student { id: string; name: string; subject: string; modality: string; }
interface StudentPackage { id: string; student_id: string; name: string; hours_total: number; hours_used: number; status: string; total_value: number; }

export default function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<StudentPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({
    student_id: "", date: format(new Date(), "yyyy-MM-dd"),
    time_start: "08:00", time_end: "09:00",
    duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "",
  });

  useEffect(() => { if (user) { loadLessons(); loadStudents(); loadPackages(); } }, [user, currentDate]);

  const loadStudents = async () => { const { data } = await supabase.from("students").select("id,name,subject,modality").eq("teacher_id", user!.id); setStudents(data || []); };
  const loadPackages = async () => { const { data } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).eq("status", "ativo"); setPackages(data || []); };
  const loadLessons = async () => {
    const start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd") + "T23:59:59";
    const { data } = await supabase.from("lessons").select("*, students(name)").eq("teacher_id", user!.id).gte("date", start).lte("date", end).order("date").order("time");
    setLessons(data || []);
  };

  const calcDuration = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.max(0, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100);
  };
  const updateTimeStart = (v: string) => { const dur = calcDuration(v, form.time_end); setForm({ ...form, time_start: v, duration: dur > 0 ? dur : form.duration }); };
  const updateTimeEnd = (v: string) => { const dur = calcDuration(form.time_start, v); setForm({ ...form, time_end: v, duration: dur > 0 ? dur : form.duration }); };
  const navigate = (dir: number) => { const d = new Date(currentDate); d.setMonth(d.getMonth() + dir); setCurrentDate(d); };

  const getStudentPackages = (sid: string) => packages.filter(p => p.student_id === sid);
  const getStudentHoursInfo = (sid: string) => {
    const pkgs = getStudentPackages(sid);
    const total = pkgs.reduce((s, p) => s + p.hours_total, 0);
    const used = pkgs.reduce((s, p) => s + p.hours_used, 0);
    return { total, used, remaining: total - used, percentage: total > 0 ? Math.round((used / total) * 100) : 0 };
  };

  const selectedStudentInfo = useMemo(() => form.student_id ? getStudentHoursInfo(form.student_id) : null, [form.student_id, packages]);
  const getLessonsForDay = (date: Date) => lessons.filter(l => isSameDay(new Date(l.date), date));
  const selectedDayLessons = useMemo(() => selectedDate ? getLessonsForDay(selectedDate) : [], [selectedDate, lessons]);

  const handleSave = async () => {
    if (!form.student_id) { toast({ title: "Selecione um aluno", variant: "destructive" }); return; }
    if (form.duration <= 0) { toast({ title: "Duração inválida", variant: "destructive" }); return; }
    const payload: any = {
      student_id: form.student_id, date: form.date, time: form.time_start,
      duration: form.duration, subject: form.subject, status: form.status,
      notes: form.notes, modality: form.modality, teacher_id: user!.id,
      package_id: form.package_id || null,
    };
    if (editing) {
      await supabase.from("lessons").update(payload).eq("id", editing.id);
      toast({ title: "Aula atualizada!" });
    } else {
      await supabase.from("lessons").insert(payload);
      toast({ title: "Aula agendada!" });
    }
    setDialogOpen(false); setEditing(null); loadLessons(); loadPackages();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    const prevStatus = lesson.status;
    const pkg = lesson.package_id ? packages.find(p => p.id === lesson.package_id) : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");

    if (pkg) {
      let hoursChange = 0;
      if (newStatus === "concluida" && prevStatus !== "concluida") hoursChange = lesson.duration;
      else if (prevStatus === "concluida" && newStatus !== "concluida") hoursChange = -lesson.duration;

      if (hoursChange !== 0) {
        const newUsed = Math.max(0, pkg.hours_used + hoursChange);
        await supabase.from("packages").update({ hours_used: newUsed, status: newUsed >= pkg.hours_total ? "concluido" : "ativo" }).eq("id", pkg.id);
        const { data: studentPkgs } = await supabase.from("packages").select("*").eq("student_id", lesson.student_id).eq("status", "ativo");
        const totalRemaining = (studentPkgs || []).reduce((s: number, p: any) => s + (p.hours_total - p.hours_used), 0);
        await supabase.from("students").update({ hours_remaining: Math.max(0, totalRemaining) }).eq("id", lesson.student_id);
        toast({ title: hoursChange > 0 ? "Aula realizada!" : "Status atualizado", description: `${Math.abs(hoursChange)}h ${hoursChange > 0 ? "descontada" : "devolvida"} do pacote` });
        loadPackages();
      } else {
        toast({ title: `Status: ${statusLabel(newStatus)}` });
      }
    } else {
      toast({ title: `Status: ${statusLabel(newStatus)}` });
    }
    await supabase.from("lessons").update({ status: newStatus }).eq("id", id);
    loadLessons();
  };

  const handleDelete = async (id: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson || !confirm("Excluir esta aula?")) return;
    if (lesson.status === "concluida") {
      const pkg = lesson.package_id ? packages.find(p => p.id === lesson.package_id) : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");
      if (pkg) {
        await supabase.from("packages").update({ hours_used: Math.max(0, pkg.hours_used - lesson.duration), status: "ativo" }).eq("id", pkg.id);
        toast({ description: `${lesson.duration}h devolvida ao pacote` });
        loadPackages();
      }
    }
    await supabase.from("lessons").delete().eq("id", id);
    toast({ title: "Aula excluída" }); loadLessons();
  };

  const openEdit = (lesson: Lesson) => {
    const [h, m] = (lesson.time || "08:00").split(":").map(Number);
    const endMin = h * 60 + m + (lesson.duration || 1) * 60;
    setEditing(lesson);
    setForm({
      student_id: lesson.student_id, date: lesson.date?.split("T")[0] || "",
      time_start: lesson.time, time_end: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(Math.round(endMin % 60)).padStart(2, "0")}`,
      duration: lesson.duration, subject: lesson.subject, status: lesson.status, notes: lesson.notes || "", modality: lesson.modality || "online",
      package_id: lesson.package_id || "",
    });
    setDialogOpen(true);
  };
  const openNew = (date?: string) => {
    setEditing(null);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time_start: "08:00", time_end: "09:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "" });
    setDialogOpen(true);
  };

  const statusStyle = (s: string) => ({ agendada: "bg-primary/10 text-primary border-primary/20", concluida: "bg-accent/10 text-accent border-accent/20", cancelada: "bg-destructive/10 text-destructive border-destructive/20", falta: "bg-warning/10 text-warning border-warning/20", remarcada: "bg-info/10 text-info border-info/20" }[s] || "bg-muted text-muted-foreground");
  const statusLabel = (s: string) => ({ agendada: "Agendada", concluida: "Realizada", cancelada: "Cancelada", falta: "Falta", remarcada: "Remarcada" }[s] || s);
  const dotColor = (s: string) => ({ agendada: "bg-primary", concluida: "bg-accent", cancelada: "bg-destructive", falta: "bg-warning", remarcada: "bg-info" }[s] || "bg-muted-foreground");

  const ms = startOfMonth(currentDate);
  const me = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) });

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dl = getLessonsForDay(day);
    if (dl.length > 0) setDetailOpen(true);
    else openNew(format(day, "yyyy-MM-dd"));
  };

  const getEndTime = (time: string, duration: number) => {
    const [h, m] = (time || "08:00").split(":").map(Number);
    const endMin = h * 60 + m + duration * 60;
    return `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(Math.round(endMin % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Agenda</h1>
        <Button onClick={() => openNew()} size="sm" className="rounded-xl shadow-sm h-9 gap-1.5">
          <Plus className="h-4 w-4" /> Nova Aula
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="text-base font-bold capitalize">{format(currentDate, "MMMM", { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(currentDate, "yyyy")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 text-xs rounded-xl px-2.5" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Calendar */}
      <Card className="card-premium overflow-hidden">
        <CardContent className="p-1.5 sm:p-3">
          <div className="grid grid-cols-7 mb-1">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-[10px] sm:text-[11px] text-center text-muted-foreground font-bold uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border/30 rounded-lg overflow-hidden">
            {calendarDays.map(day => {
              const dl = getLessonsForDay(day);
              const inMonth = day.getMonth() === currentDate.getMonth();
              const today = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button key={day.toISOString()} onClick={() => handleDayClick(day)}
                  className={`relative flex flex-col items-center justify-start py-2 sm:py-3 min-h-[44px] sm:min-h-[56px] bg-card transition-all ${!inMonth ? "opacity-25" : ""} ${isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"}`}>
                  <span className={`text-xs sm:text-sm font-medium leading-none ${today ? "bg-primary text-primary-foreground w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold" : ""}`}>
                    {format(day, "d")}
                  </span>
                  {dl.length > 0 && (
                    <div className="flex items-center gap-[3px] mt-1.5">
                      {dl.slice(0, 3).map((l, i) => <span key={i} className={`w-[5px] h-[5px] rounded-full ${dotColor(l.status)}`} />)}
                      {dl.length > 3 && <span className="text-[7px] text-muted-foreground font-bold">+{dl.length - 3}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</DialogTitle>
            <DialogDescription className="text-xs">{selectedDayLessons.length} aula(s) neste dia</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {selectedDayLessons.map(lesson => {
              const pkgInfo = getStudentHoursInfo(lesson.student_id);
              return (
                <div key={lesson.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{lesson.students?.name}</p>
                      <p className="text-xs text-muted-foreground">{lesson.subject || "Sem disciplina"}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 px-2 border shrink-0 ${statusStyle(lesson.status)}`}>{statusLabel(lesson.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {lesson.time} – {getEndTime(lesson.time, lesson.duration)}</span>
                    <span className="font-bold text-foreground">{lesson.duration}h</span>
                    <span className="flex items-center gap-1 capitalize"><MapPin className="h-3.5 w-3.5" /> {lesson.modality}</span>
                  </div>
                  {lesson.notes && <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">{lesson.notes}</p>}

                  {pkgInfo.total > 0 && (
                    <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-primary flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Pacote</span>
                        <span className="text-muted-foreground">{pkgInfo.percentage}% consumido</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-sm font-bold">{pkgInfo.total}h</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                        <div><p className="text-sm font-bold">{pkgInfo.used}h</p><p className="text-[10px] text-muted-foreground">Abatidas</p></div>
                        <div><p className={`text-sm font-bold ${pkgInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{pkgInfo.remaining}h</p><p className="text-[10px] text-muted-foreground">Restantes</p></div>
                      </div>
                      <Progress value={pkgInfo.percentage} className="h-1.5" />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lesson.status === "agendada" && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-accent border-accent/30 hover:bg-accent/10" onClick={() => updateStatus(lesson.id, "concluida")}><Check className="h-3.5 w-3.5" /> Realizada</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-info border-info/30 hover:bg-info/10" onClick={() => updateStatus(lesson.id, "remarcada")}><RotateCcw className="h-3.5 w-3.5" /> Remarcar</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateStatus(lesson.id, "cancelada")}><XIcon className="h-3.5 w-3.5" /> Cancelar</Button>
                      </>
                    )}
                    {lesson.status === "concluida" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-warning border-warning/30 hover:bg-warning/10" onClick={() => updateStatus(lesson.id, "agendada")}><RotateCcw className="h-3.5 w-3.5" /> Desfazer</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-xl gap-1" onClick={() => { setDetailOpen(false); openEdit(lesson); }}><Edit className="h-3.5 w-3.5" /> Editar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-xl gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(lesson.id)}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" className="w-full h-10 rounded-xl text-sm" onClick={() => { setDetailOpen(false); openNew(selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Agendar aula neste dia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New/Edit Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg font-bold">{editing ? "Editar Aula" : "Agendar Aula"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Aluno *</Label>
              <Select value={form.student_id} onValueChange={v => {
                const st = students.find(s => s.id === v);
                const stPkgs = getStudentPackages(v);
                setForm({ ...form, student_id: v, subject: st?.subject || form.subject, modality: st?.modality || form.modality, package_id: stPkgs.length > 0 ? stPkgs[0].id : "" });
              }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {form.student_id && selectedStudentInfo && selectedStudentInfo.total > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Pacote do Aluno</span>
                  <span className="text-muted-foreground">{selectedStudentInfo.percentage}% consumido</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold">{selectedStudentInfo.total}h</p><p className="text-[10px] text-muted-foreground">Contratadas</p></div>
                  <div><p className="text-lg font-bold">{selectedStudentInfo.used}h</p><p className="text-[10px] text-muted-foreground">Abatidas</p></div>
                  <div><p className={`text-lg font-bold ${selectedStudentInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{selectedStudentInfo.remaining}h</p><p className="text-[10px] text-muted-foreground">Restantes</p></div>
                </div>
                <Progress value={selectedStudentInfo.percentage} className="h-2" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10 rounded-xl" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hora Inicial</Label>
                <Input type="time" value={form.time_start} onChange={e => updateTimeStart(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hora Final</Label>
                <Input type="time" value={form.time_end} onChange={e => updateTimeEnd(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duração</Label>
                <div className="h-10 flex items-center justify-center rounded-xl border border-input bg-muted/50 text-sm font-bold text-primary">{form.duration}h</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Disciplina</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: Matemática" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Modalidade</Label>
                <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="presencial">Presencial</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm rounded-xl" />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-semibold">{editing ? "Salvar" : "Agendar"}</Button>
              {editing && <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive h-11 rounded-xl"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
