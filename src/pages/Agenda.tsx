import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Trash2, Check, RotateCcw, AlertTriangle, Package, X as XIcon } from "lucide-react";
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

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("id,name,subject,modality").eq("teacher_id", user!.id);
    setStudents(data || []);
  };

  const loadPackages = async () => {
    const { data } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).eq("status", "ativo");
    setPackages(data || []);
  };

  const loadLessons = async () => {
    const start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd") + "T23:59:59";
    const { data } = await supabase.from("lessons").select("*, students(name)")
      .eq("teacher_id", user!.id).gte("date", start).lte("date", end).order("date").order("time");
    setLessons(data || []);
  };

  const calcDuration = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.max(0, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100);
  };

  const updateTimeStart = (v: string) => {
    const dur = calcDuration(v, form.time_end);
    setForm({ ...form, time_start: v, duration: dur > 0 ? dur : form.duration });
  };

  const updateTimeEnd = (v: string) => {
    const dur = calcDuration(form.time_start, v);
    setForm({ ...form, time_end: v, duration: dur > 0 ? dur : form.duration });
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const getStudentPackages = (studentId: string) => packages.filter(p => p.student_id === studentId);

  const getStudentHoursInfo = (studentId: string) => {
    const pkgs = getStudentPackages(studentId);
    const total = pkgs.reduce((s, p) => s + p.hours_total, 0);
    const used = pkgs.reduce((s, p) => s + p.hours_used, 0);
    const remaining = total - used;
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    return { total, used, remaining, percentage };
  };

  const selectedStudentInfo = useMemo(() => {
    if (!form.student_id) return null;
    return getStudentHoursInfo(form.student_id);
  }, [form.student_id, packages]);

  const getLessonsForDay = (date: Date) => lessons.filter(l => isSameDay(new Date(l.date), date));

  const selectedDayLessons = useMemo(() => {
    if (!selectedDate) return [];
    return getLessonsForDay(selectedDate);
  }, [selectedDate, lessons]);

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

    const pkg = lesson.package_id
      ? packages.find(p => p.id === lesson.package_id)
      : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");

    if (pkg) {
      let hoursChange = 0;

      // Only "realizada" deducts hours
      if (newStatus === "concluida" && prevStatus !== "concluida") {
        hoursChange = lesson.duration;
      }
      // Reverting from concluida returns hours
      else if (prevStatus === "concluida" && newStatus !== "concluida") {
        hoursChange = -lesson.duration;
      }
      // Falta as penalty (only if not already deducted)
      else if (newStatus === "falta" && prevStatus !== "falta" && prevStatus !== "concluida") {
        hoursChange = lesson.duration;
      }
      // Reverting falta returns hours
      else if (prevStatus === "falta" && newStatus !== "falta" && newStatus !== "concluida") {
        hoursChange = -lesson.duration;
      }

      if (hoursChange !== 0) {
        const newUsed = Math.max(0, pkg.hours_used + hoursChange);
        const newPkgStatus = newUsed >= pkg.hours_total ? "concluido" : "ativo";
        await supabase.from("packages").update({ hours_used: newUsed, status: newPkgStatus }).eq("id", pkg.id);

        // Update student hours_remaining
        const { data: studentPkgs } = await supabase.from("packages").select("*").eq("student_id", lesson.student_id).eq("status", "ativo");
        const totalRemaining = (studentPkgs || []).reduce((s, p) => s + (p.hours_total - p.hours_used), 0);
        await supabase.from("students").update({ hours_remaining: Math.max(0, totalRemaining - (hoursChange > 0 ? hoursChange : 0)) }).eq("id", lesson.student_id);

        const action = hoursChange > 0 ? "descontada" : "devolvida";
        toast({ title: newStatus === "falta" ? "Falta registrada" : newStatus === "concluida" ? "Aula realizada!" : "Status atualizado",
          description: `${Math.abs(hoursChange)}h ${action} do pacote` });
        loadPackages();
      } else {
        toast({ title: newStatus === "remarcada" ? "Aula remarcada" : `Status: ${statusLabel(newStatus)}` });
      }
    } else {
      toast({ title: `Status: ${statusLabel(newStatus)}` });
    }

    await supabase.from("lessons").update({ status: newStatus }).eq("id", id);
    loadLessons();
  };

  const handleDelete = async (id: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    if (!confirm("Excluir esta aula?")) return;

    // If lesson was realized, return hours before deleting
    if (lesson.status === "concluida" || lesson.status === "falta") {
      const pkg = lesson.package_id
        ? packages.find(p => p.id === lesson.package_id)
        : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");
      if (pkg) {
        const newUsed = Math.max(0, pkg.hours_used - lesson.duration);
        await supabase.from("packages").update({ hours_used: newUsed, status: "ativo" }).eq("id", pkg.id);
        toast({ description: `${lesson.duration}h devolvida ao pacote` });
        loadPackages();
      }
    }

    await supabase.from("lessons").delete().eq("id", id);
    toast({ title: "Aula excluída" }); loadLessons();
  };

  const openEdit = (lesson: Lesson) => {
    const [h, m] = (lesson.time || "08:00").split(":").map(Number);
    const endMinutes = h * 60 + m + (lesson.duration || 1) * 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    setEditing(lesson);
    setForm({
      student_id: lesson.student_id, date: lesson.date?.split("T")[0] || "",
      time_start: lesson.time, time_end: `${String(endH).padStart(2, "0")}:${String(Math.round(endM)).padStart(2, "0")}`,
      duration: lesson.duration, subject: lesson.subject,
      status: lesson.status, notes: lesson.notes || "", modality: lesson.modality || "online",
      package_id: lesson.package_id || "",
    });
    setDialogOpen(true);
  };

  const openNew = (date?: string) => {
    setEditing(null);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time_start: "08:00", time_end: "09:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "" });
    setDialogOpen(true);
  };

  const statusStyle = (s: string) => {
    const m: Record<string, string> = {
      agendada: "bg-primary/10 text-primary border-primary/20",
      concluida: "bg-accent/10 text-accent border-accent/20",
      cancelada: "bg-destructive/10 text-destructive border-destructive/20",
      falta: "bg-warning/10 text-warning border-warning/20",
      remarcada: "bg-info/10 text-info border-info/20",
    };
    return m[s] || "bg-muted text-muted-foreground";
  };

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { agendada: "Agendada", concluida: "Realizada", cancelada: "Cancelada", falta: "Falta", remarcada: "Remarcada" };
    return m[s] || s;
  };

  const dotColor = (s: string) => {
    const m: Record<string, string> = {
      agendada: "bg-primary",
      concluida: "bg-accent",
      cancelada: "bg-destructive",
      falta: "bg-warning",
      remarcada: "bg-info",
    };
    return m[s] || "bg-muted-foreground";
  };

  // Calendar render
  const ms = startOfMonth(currentDate);
  const me = endOfMonth(currentDate);
  const monthStart = startOfWeek(ms, { weekStartsOn: 1 });
  const monthEnd = endOfWeek(me, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handleDayClick = (day: Date) => {
    const dayLessons = getLessonsForDay(day);
    setSelectedDate(day);
    if (dayLessons.length > 0) {
      setDetailOpen(true);
    } else {
      openNew(format(day, "yyyy-MM-dd"));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Agenda</h1>
        <Button onClick={() => openNew()} size="sm" className="rounded-lg shadow-sm h-9">
          <Plus className="h-4 w-4 mr-1.5" /> Nova Aula
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-base font-bold capitalize text-foreground">
            {format(currentDate, "MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground">{format(currentDate, "yyyy")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg px-2.5" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="card-premium overflow-hidden">
        <CardContent className="p-2 sm:p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-[10px] sm:text-xs text-center text-muted-foreground font-semibold uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map(day => {
              const dl = getLessonsForDay(day);
              const inMonth = day.getMonth() === currentDate.getMonth();
              const today = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const hasLessons = dl.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative flex flex-col items-center justify-start py-2 sm:py-3 min-h-[48px] sm:min-h-[60px]
                    transition-all duration-150 rounded-lg
                    ${!inMonth ? "opacity-30" : ""}
                    ${isSelected ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-muted/50"}
                  `}
                >
                  <span className={`
                    text-sm sm:text-base font-medium leading-none
                    ${today ? "bg-primary text-primary-foreground w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold" : ""}
                    ${!today && inMonth ? "text-foreground" : ""}
                  `}>
                    {format(day, "d")}
                  </span>

                  {/* Dots for events */}
                  {hasLessons && (
                    <div className="flex items-center gap-0.5 mt-1.5">
                      {dl.slice(0, 3).map((l, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor(l.status)}`} />
                      ))}
                      {dl.length > 3 && (
                        <span className="text-[8px] text-muted-foreground font-medium ml-0.5">+{dl.length - 3}</span>
                      )}
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
            <DialogTitle className="text-base">
              {selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedDayLessons.length} aula(s) neste dia
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedDayLessons.map(lesson => {
              const pkgInfo = getStudentHoursInfo(lesson.student_id);
              const [h, m] = (lesson.time || "08:00").split(":").map(Number);
              const endMinutes = h * 60 + m + (lesson.duration || 1) * 60;
              const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(Math.round(endMinutes % 60)).padStart(2, "0")}`;

              return (
                <div key={lesson.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{lesson.students?.name}</p>
                      <p className="text-xs text-muted-foreground">{lesson.subject || "Sem disciplina"}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 px-2 border shrink-0 ${statusStyle(lesson.status)}`}>
                      {statusLabel(lesson.status)}
                    </Badge>
                  </div>

                  {/* Time info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {lesson.time} – {endTime}</span>
                    <span className="font-semibold text-foreground">{lesson.duration}h</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {lesson.modality}</span>
                  </div>

                  {/* Notes */}
                  {lesson.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/30">
                      {lesson.notes}
                    </p>
                  )}

                  {/* Package progress */}
                  {pkgInfo.total > 0 && (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-primary flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" /> Pacote
                        </span>
                        <span className="text-muted-foreground">{pkgInfo.percentage}% consumido</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-sm font-bold text-foreground">{pkgInfo.total}h</p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{pkgInfo.used}h</p>
                          <p className="text-[10px] text-muted-foreground">Usadas</p>
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${pkgInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{pkgInfo.remaining}h</p>
                          <p className="text-[10px] text-muted-foreground">Restantes</p>
                        </div>
                      </div>
                      <Progress value={pkgInfo.percentage} className="h-1.5" />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lesson.status === "agendada" && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1 text-accent border-accent/30 hover:bg-accent/10" onClick={() => updateStatus(lesson.id, "concluida")}>
                          <Check className="h-3.5 w-3.5" /> Realizada
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1 text-info border-info/30 hover:bg-info/10" onClick={() => updateStatus(lesson.id, "remarcada")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Remarcar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1 text-warning border-warning/30 hover:bg-warning/10" onClick={() => updateStatus(lesson.id, "falta")}>
                          <AlertTriangle className="h-3.5 w-3.5" /> Falta
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateStatus(lesson.id, "cancelada")}>
                          <XIcon className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg gap-1" onClick={() => { setDetailOpen(false); openEdit(lesson); }}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(lesson.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" className="w-full h-10 rounded-lg text-sm" onClick={() => { setDetailOpen(false); openNew(selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Agendar aula neste dia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New/Edit Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "Editar Aula" : "Agendar Aula"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Aluno *</Label>
              <Select value={form.student_id} onValueChange={v => {
                const st = students.find(s => s.id === v);
                const stPkgs = getStudentPackages(v);
                setForm({ ...form, student_id: v, subject: st?.subject || form.subject, modality: st?.modality || form.modality, package_id: stPkgs.length > 0 ? stPkgs[0].id : "" });
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {form.student_id && selectedStudentInfo && selectedStudentInfo.total > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Pacote do Aluno</span>
                  <span className="text-muted-foreground">{selectedStudentInfo.percentage}% consumido</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold text-foreground">{selectedStudentInfo.total}h</p><p className="text-[10px] text-muted-foreground">Contratadas</p></div>
                  <div><p className="text-lg font-bold text-foreground">{selectedStudentInfo.used}h</p><p className="text-[10px] text-muted-foreground">Utilizadas</p></div>
                  <div><p className={`text-lg font-bold ${selectedStudentInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{selectedStudentInfo.remaining}h</p><p className="text-[10px] text-muted-foreground">Restantes</p></div>
                </div>
                <Progress value={selectedStudentInfo.percentage} className="h-2" />
              </div>
            )}

            {form.student_id && getStudentPackages(form.student_id).length > 1 && (
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

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-9" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hora Inicial</Label>
                <Input type="time" value={form.time_start} onChange={e => updateTimeStart(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hora Final</Label>
                <Input type="time" value={form.time_end} onChange={e => updateTimeEnd(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duração</Label>
                <div className="h-9 flex items-center justify-center rounded-md border border-input bg-muted/50 text-sm font-bold text-primary">
                  {form.duration}h
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="concluida">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="remarcada">Remarcada</SelectItem>
                  <SelectItem value="falta">Falta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-10 rounded-lg">{editing ? "Salvar" : "Agendar"}</Button>
              {editing && <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive h-10 rounded-lg"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
