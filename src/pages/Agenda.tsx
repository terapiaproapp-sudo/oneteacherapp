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
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Edit, Trash2, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "day" | "week" | "month";

interface Lesson {
  id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  time: string;
  duration: number;
  subject: string;
  status: string;
  notes: string;
  modality: string;
  students?: { name: string };
}

interface Student {
  id: string;
  name: string;
  subject: string;
  modality: string;
}

export default function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({
    student_id: "", date: format(new Date(), "yyyy-MM-dd"), time: "08:00",
    duration: 1, subject: "", status: "agendada", notes: "", modality: "online",
  });

  useEffect(() => {
    if (user) { loadLessons(); loadStudents(); }
  }, [user, currentDate, view]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("id,name,subject,modality").eq("teacher_id", user!.id);
    setStudents(data || []);
  };

  const loadLessons = async () => {
    let start: string, end: string;
    if (view === "day") {
      start = format(currentDate, "yyyy-MM-dd");
      end = start + "T23:59:59";
    } else if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      start = format(ws, "yyyy-MM-dd");
      end = format(we, "yyyy-MM-dd") + "T23:59:59";
    } else {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      start = format(ms, "yyyy-MM-dd");
      end = format(me, "yyyy-MM-dd") + "T23:59:59";
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
    const payload = { ...form, teacher_id: user!.id };
    if (editing) {
      const { error } = await supabase.from("lessons").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aula atualizada!" });
    } else {
      const { error } = await supabase.from("lessons").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aula agendada!" });
    }
    setDialogOpen(false);
    setEditing(null);
    loadLessons();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("lessons").update({ status }).eq("id", id);
    toast({ title: `Aula marcada como ${status}` });
    loadLessons();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    toast({ title: "Aula excluída" });
    loadLessons();
  };

  const openEdit = (lesson: Lesson) => {
    setEditing(lesson);
    setForm({
      student_id: lesson.student_id, date: lesson.date?.split("T")[0] || "",
      time: lesson.time, duration: lesson.duration, subject: lesson.subject,
      status: lesson.status, notes: lesson.notes || "", modality: lesson.modality || "online",
    });
    setDialogOpen(true);
  };

  const openNew = (date?: string) => {
    setEditing(null);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time: "08:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online" });
    setDialogOpen(true);
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      agendada: "bg-primary/10 text-primary",
      concluida: "bg-success/10 text-success",
      cancelada: "bg-destructive/10 text-destructive",
      falta: "bg-warning/10 text-warning",
      reposicao: "bg-info/10 text-info",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  const getLessonsForDay = (date: Date) => lessons.filter(l => isSameDay(new Date(l.date), date));

  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map(day => (
          <div key={day.toISOString()} className={`border rounded-lg p-2 min-h-[120px] ${isToday(day) ? "border-primary bg-primary/5" : "border-border"}`}>
            <div className="text-xs font-medium text-center mb-2">
              <span className="text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</span>
              <br />
              <span className={isToday(day) ? "text-primary font-bold" : ""}>{format(day, "dd")}</span>
            </div>
            {getLessonsForDay(day).map(lesson => (
              <div key={lesson.id} onClick={() => openEdit(lesson)} className={`p-1.5 mb-1 rounded text-xs cursor-pointer hover:opacity-80 ${statusColor(lesson.status)}`}>
                <p className="font-medium truncate">{lesson.students?.name}</p>
                <p className="truncate">{lesson.time} • {lesson.duration}h</p>
              </div>
            ))}
            <button onClick={() => openNew(format(day, "yyyy-MM-dd"))} className="text-xs text-muted-foreground hover:text-primary w-full text-center mt-1">+</button>
          </div>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    const dayLessons = getLessonsForDay(currentDate);
    return (
      <div className="space-y-3">
        {dayLessons.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhuma aula neste dia.</p>
        ) : dayLessons.map(lesson => (
          <Card key={lesson.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]">
                    <p className="text-lg font-bold text-primary">{lesson.time}</p>
                    <p className="text-xs text-muted-foreground">{lesson.duration}h</p>
                  </div>
                  <div>
                    <p className="font-semibold">{lesson.students?.name}</p>
                    <p className="text-sm text-muted-foreground">{lesson.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={statusColor(lesson.status)}>{lesson.status}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{lesson.modality}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(lesson)}><Edit className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(lesson.id, "concluida")} className="text-success"><Clock className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(lesson.id, "cancelada")} className="text-destructive"><X className="h-3 w-3" /></Button>
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
            <div key={d} className="text-xs text-center text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dl = getLessonsForDay(day);
            const inMonth = day.getMonth() === currentDate.getMonth();
            return (
              <div key={day.toISOString()} onClick={() => { setCurrentDate(day); setView("day"); }}
                className={`border rounded p-1 min-h-[60px] cursor-pointer hover:bg-muted/50 ${isToday(day) ? "border-primary" : "border-border"} ${!inMonth ? "opacity-30" : ""}`}>
                <p className={`text-xs text-right ${isToday(day) ? "text-primary font-bold" : ""}`}>{format(day, "d")}</p>
                {dl.slice(0, 2).map(l => (
                  <div key={l.id} className={`text-[10px] rounded px-1 mt-0.5 truncate ${statusColor(l.status)}`}>{l.students?.name}</div>
                ))}
                {dl.length > 2 && <p className="text-[10px] text-muted-foreground text-center">+{dl.length - 2}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" /> Nova Aula</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Aula" : "Agendar Aula"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <Select value={form.student_id} onValueChange={v => {
                  const st = students.find(s => s.id === v);
                  setForm({ ...form, student_id: v, subject: st?.subject || form.subject, modality: st?.modality || form.modality });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Horário</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Duração (h)</Label><Input type="number" step="0.5" value={form.duration} onChange={e => setForm({ ...form, duration: parseFloat(e.target.value) || 1 })} /></div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Disciplina</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">{editing ? "Salvar" : "Agendar"}</Button>
                {editing && <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {view === "day" && format(currentDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            {view === "week" && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "dd/MM")}`}
            {view === "month" && format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        </div>
        <div className="flex gap-1">
          {(["day", "week", "month"] as ViewMode[]).map(v => (
            <Button key={v} variant={view === v ? "default" : "outline"} size="sm" onClick={() => setView(v)}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </Button>
          ))}
        </div>
      </div>

      {view === "day" && renderDayView()}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}
    </div>
  );
}
