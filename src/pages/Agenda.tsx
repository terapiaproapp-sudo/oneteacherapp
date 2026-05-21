import { useEffect, useState, useMemo, useRef } from "react";
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
import {
  Plus, ChevronLeft, ChevronRight, Clock, MapPin, Trash2, Check, RotateCcw,
  Package, X as XIcon, Edit, CalendarPlus, MessageCircle, Upload, FileText, Image as ImageIcon,
  UserX, Repeat
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";

interface Lesson {
  id: string; student_id: string; teacher_id: string; date: string;
  time: string; duration: number; subject: string; status: string;
  notes: string; modality: string; package_id: string | null;
  receipt_url?: string | null;
  students?: { name: string; phone?: string };
}
interface Student { id: string; name: string; subject: string; modality: string; phone?: string; enrollment_type?: string; }
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
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    student_id: "", date: format(new Date(), "yyyy-MM-dd"),
    time_start: "08:00", time_end: "09:00",
    duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "",
    recurrence: "unica" as string, recurrence_days: [] as number[], recurrence_end: "",
  });

  useEffect(() => { if (user) { loadLessons(); loadStudents(); loadPackages(); } }, [user, currentDate]);

  const loadStudents = async () => { const { data } = await supabase.from("students").select("id,name,subject,modality,phone,enrollment_type").eq("teacher_id", user!.id).order("name"); setStudents(data || []); };
  const loadPackages = async () => { const { data } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).eq("status", "ativo"); setPackages(data || []); };
  const loadLessons = async () => {
    const start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd") + "T23:59:59";
    const { data } = await supabase.from("lessons").select("*, students(name, phone)").eq("teacher_id", user!.id).gte("date", start).lte("date", end).order("date").order("time");
    setLessons(data || []);
  };

  // Duration calculated as decimal hours (e.g. 1.5 = 1h30). Storage uses decimal hours.
  const calcDuration = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, Math.round(totalMinutes) / 60);
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
  const parseLocalDate = (dateStr: string) => new Date(dateStr.split("T")[0] + "T00:00:00");
  const getLessonsForDay = (date: Date) => lessons.filter(l => isSameDay(parseLocalDate(l.date), date));
  const selectedDayLessons = useMemo(() => selectedDate ? getLessonsForDay(selectedDate) : [], [selectedDate, lessons]);

  const generateRecurrenceDates = (
    baseDate: string,
    recurrence: string,
    days: number[],
    endDate: string | null,
    maxOccurrences: number | null,
    duration: number,
    availableHours: number | null
  ): { date: string; studentRemainingHours: number }[] => {
    if (recurrence === "unica") return [{ date: baseDate, studentRemainingHours: availableHours !== null ? availableHours - duration : 0 }];
    
    const dates: { date: string; studentRemainingHours: number }[] = [];
    const start = new Date(baseDate + "T12:00:00");
    const current = new Date(start);
    let remaining = availableHours !== null ? availableHours : 999999;
    
    const limitDate = endDate ? new Date(endDate + "T12:00:00") : null;
    const limitOccurrences = maxOccurrences || 500; // Safety limit
    
    while (dates.length < limitOccurrences) {
      if (limitDate && current > limitDate) break;
      if (availableHours !== null && remaining < duration - 0.01) break; // Use small epsilon for float precision

      let shouldAdd = false;
      if (recurrence === "diaria") {
        shouldAdd = true;
      } else if (recurrence === "semanal") {
        if (days.length === 0 || days.includes(current.getDay())) {
          shouldAdd = true;
        }
      } else if (recurrence === "mensal") {
        shouldAdd = true;
      }

      if (shouldAdd) {
        remaining -= duration;
        dates.push({ 
          date: format(current, "yyyy-MM-dd"), 
          studentRemainingHours: Math.max(0, remaining)
        });
      }

      if (recurrence === "diaria") {
        current.setDate(current.getDate() + 1);
      } else if (recurrence === "semanal") {
        current.setDate(current.getDate() + 1);
      } else if (recurrence === "mensal") {
        current.setMonth(current.getMonth() + 1);
      }
      
      if (dates.length >= 500) break; // Absolute safety limit
    }
    
    return dates.length > 0 ? dates : [{ date: baseDate, studentRemainingHours: remaining }];
  };

  const [showRecurrencePreview, setShowRecurrencePreview] = useState(false);
  const [recurrencePreviewData, setRecurrencePreviewData] = useState<{ date: string; studentRemainingHours: number }[]>([]);

  const handleSave = async () => {
    if (!form.student_id) { toast({ title: "Selecione um aluno", variant: "destructive" }); return; }
    if (form.duration <= 0) { toast({ title: "Duração inválida", variant: "destructive" }); return; }
    
    const student = students.find(s => s.id === form.student_id);
    const hasPackage = student?.enrollment_type === "pacote";
    const hoursInfo = getStudentHoursInfo(form.student_id);
    
    if (form.recurrence !== "unica" && !showRecurrencePreview) {
      if (!hasPackage && !form.recurrence_end) {
        toast({ title: "Atenção", description: "Informe uma data final para criar a recorrência.", variant: "destructive" });
        return;
      }
      
      const availableHours = hasPackage ? hoursInfo.remaining : null;
      const preview = generateRecurrenceDates(
        form.date, 
        form.recurrence, 
        form.recurrence_days, 
        form.recurrence_end,
        null, // No max occurrences field currently
        form.duration,
        availableHours
      );
      
      setRecurrencePreviewData(preview);
      setShowRecurrencePreview(true);
      return;
    }

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
      if (form.recurrence !== "unica") {
        const rows = recurrencePreviewData.map(d => ({ ...payload, date: d.date }));
        await supabase.from("lessons").insert(rows);
        toast({ title: `${recurrencePreviewData.length} aulas agendadas!`, description: `Recorrência ${form.recurrence} criada.` });
      } else {
        await supabase.from("lessons").insert(payload);
        toast({ title: "Aula agendada!" });
      }
    }
    
    setDialogOpen(false); setEditing(null); setShowRecurrencePreview(false); loadLessons(); loadPackages();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    const prevStatus = lesson.status;
    const student = students.find(s => s.id === lesson.student_id);
    const pkg = lesson.package_id ? packages.find(p => p.id === lesson.package_id) : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");

    if (pkg && student?.enrollment_type === "pacote") {
      let hoursChange = 0;
      const deductsHours = newStatus === "concluida" || newStatus === "noshow";
      const prevDeducted = prevStatus === "concluida" || prevStatus === "noshow";
      if (deductsHours && !prevDeducted) hoursChange = lesson.duration;
      else if (prevDeducted && !deductsHours) hoursChange = -lesson.duration;

      if (hoursChange !== 0) {
        const newUsed = Math.max(0, pkg.hours_used + hoursChange);
        await supabase.from("packages").update({ hours_used: newUsed, status: newUsed >= pkg.hours_total ? "concluido" : "ativo" }).eq("id", pkg.id);
        const { data: studentPkgs } = await supabase.from("packages").select("*").eq("student_id", lesson.student_id).eq("status", "ativo");
        const totalRemaining = (studentPkgs || []).reduce((s: number, p: any) => s + (p.hours_total - p.hours_used), 0);
        await supabase.from("students").update({ hours_remaining: Math.max(0, totalRemaining) }).eq("id", lesson.student_id);
        toast({ title: hoursChange > 0 ? "Aula realizada!" : "Status atualizado", description: `${formatHoursDisplay(Math.abs(hoursChange))} ${hoursChange > 0 ? "descontada" : "devolvida"} do pacote` });
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
   if (lesson.status === "concluida" || lesson.status === "noshow") {
      const student = students.find(s => s.id === lesson.student_id);
      const pkg = lesson.package_id ? packages.find(p => p.id === lesson.package_id) : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");
      if (pkg && student?.enrollment_type === "pacote") {
        const newUsed = Math.max(0, pkg.hours_used - lesson.duration);
        await supabase.from("packages").update({ hours_used: newUsed, status: newUsed < pkg.hours_total ? "ativo" : "concluido" }).eq("id", pkg.id);
        // Also sync student hours_remaining
        const { data: studentPkgs } = await supabase.from("packages").select("*").eq("student_id", lesson.student_id).eq("status", "ativo");
        const totalRemaining = (studentPkgs || []).reduce((s: number, p: any) => s + (p.hours_total - p.hours_used), 0);
        await supabase.from("students").update({ hours_remaining: Math.max(0, totalRemaining) }).eq("id", lesson.student_id);
        toast({ description: `${formatHoursDisplay(lesson.duration)} devolvida ao pacote` });
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
      package_id: lesson.package_id || "", recurrence: "unica", recurrence_days: [], recurrence_end: "",
    });
    setDialogOpen(true);
  };
  const openNew = (date?: string) => {
    setEditing(null);
    setShowRecurrencePreview(false);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time_start: "08:00", time_end: "09:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "", recurrence: "unica", recurrence_days: [], recurrence_end: "" });
    setDialogOpen(true);
  };

  // WhatsApp
  const sendWhatsApp = (lesson: Lesson) => {
    const student = students.find(s => s.id === lesson.student_id);
    const phone = student?.phone || lesson.students?.phone;
    if (!phone) { toast({ title: "Telefone não cadastrado", description: "Cadastre o telefone do aluno para enviar mensagens.", variant: "destructive" }); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const name = lesson.students?.name || student?.name || "Aluno";
    const dateFormatted = lesson.date ? format(new Date(lesson.date + "T12:00:00"), "dd/MM/yyyy") : "";
    const msg = encodeURIComponent(
      `Olá, ${name}! 😊\n\nSua aula de *${lesson.subject || "aula"}* está marcada para *${dateFormatted}* às *${lesson.time}*.\n\nPor favor, responda com:\n👉 *Confirmar*\n👉 *Remarcar*\n👉 *Cancelar*\n\nAguardo sua confirmação! 📚`
    );
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  // Calendar export (.ics)
  const exportToCalendar = (lesson: Lesson) => {
    const name = lesson.students?.name || "Aula";
    const [h, m] = (lesson.time || "08:00").split(":").map(Number);
    const startDate = new Date(lesson.date + "T12:00:00");
    startDate.setHours(h, m, 0, 0);
    const endDate = new Date(startDate.getTime() + lesson.duration * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OneTeacher//PT", "BEGIN:VEVENT",
      `DTSTART:${fmt(startDate)}`, `DTEND:${fmt(endDate)}`,
      `SUMMARY:Aula - ${name} - ${lesson.subject || ""}`,
      `DESCRIPTION:${lesson.notes || ""}`,
      `LOCATION:${lesson.modality === "online" ? "Online" : "Presencial"}`,
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:Aula em 30 min - ${name}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aula-${name.replace(/\s/g, "_")}.ics`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Evento exportado! 📅", description: "Abra o arquivo para adicionar ao calendário." });
  };

  // Receipt upload
  const handleReceiptUpload = async (lessonId: string, file: File) => {
    setUploadingReceipt(lessonId);
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${lessonId}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); setUploadingReceipt(null); return; }
    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
    await supabase.from("lessons").update({ receipt_url: urlData.publicUrl }).eq("id", lessonId);
    toast({ title: "Comprovante anexado! ✅" });
    setUploadingReceipt(null);
    loadLessons();
  };

  const deleteReceipt = async (lessonId: string, receiptUrl: string) => {
    const pathMatch = receiptUrl.split("/receipts/")[1];
    if (pathMatch) await supabase.storage.from("receipts").remove([decodeURIComponent(pathMatch)]);
    await supabase.from("lessons").update({ receipt_url: null }).eq("id", lessonId);
    toast({ title: "Comprovante removido" }); loadLessons();
  };

  const statusStyle = (s: string) => ({ agendada: "bg-primary/10 text-primary border-primary/20", concluida: "bg-accent/10 text-accent border-accent/20", cancelada: "bg-destructive/10 text-destructive border-destructive/20", falta: "bg-warning/10 text-warning border-warning/20", remarcada: "bg-info/10 text-info border-info/20", noshow: "bg-destructive/10 text-destructive border-destructive/20" }[s] || "bg-muted text-muted-foreground");
  const statusLabel = (s: string) => ({ agendada: "Agendada", concluida: "Realizada", cancelada: "Cancelada", falta: "Falta", remarcada: "Remarcada", noshow: "No-show" }[s] || s);
  const dotColor = (s: string) => ({ agendada: "bg-primary", concluida: "bg-accent", cancelada: "bg-destructive", falta: "bg-warning", remarcada: "bg-info", noshow: "bg-destructive" }[s] || "bg-muted-foreground");

  const ms = startOfMonth(currentDate);
  const me = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) });

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dl = getLessonsForDay(day);
    if (dl.length > 0) setDetailOpen(true);
    else openNew(format(day, "yyyy-MM-dd"));
  };


  return (
    <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
      {/* Hidden file input for receipt upload */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf"
        onChange={e => { const f = e.target.files?.[0]; if (f && uploadingReceipt) handleReceiptUpload(uploadingReceipt, f); e.target.value = ""; }} />

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
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {lesson.time} – {calculateEndTime(lesson.time, lesson.duration)}</span>
                    <span className="font-bold text-foreground">{formatHoursDisplay(lesson.duration)}</span>
                    <span className="flex items-center gap-1 capitalize"><MapPin className="h-3.5 w-3.5" /> {lesson.modality}</span>
                  </div>
                  {lesson.notes && <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">{lesson.notes}</p>}

                  {/* Package summary */}
                  {pkgInfo.total > 0 && (
                    <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-primary flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Pacote</span>
                         <span className="text-muted-foreground">{pkgInfo.percentage}% consumido</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2 text-center">
                         <div><p className="text-sm font-bold">{formatHoursDisplay(pkgInfo.total)}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                         <div><p className="text-sm font-bold">{formatHoursDisplay(pkgInfo.used)}</p><p className="text-[10px] text-muted-foreground">Abatidas</p></div>
                         <div><p className={`text-sm font-bold ${pkgInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{formatHoursDisplay(pkgInfo.remaining)}</p><p className="text-[10px] text-muted-foreground">Restantes</p></div>
                      </div>
                      <Progress value={pkgInfo.percentage} className="h-1.5" />
                    </div>
                  )}

                  {/* Receipt */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Comprovante</p>
                    {lesson.receipt_url ? (
                      <div className="flex items-center gap-2">
                        <a href={lesson.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                          {lesson.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          Ver comprovante
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:bg-destructive/10 rounded-lg px-2"
                          onClick={() => deleteReceipt(lesson.id, lesson.receipt_url!)}>Remover</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1"
                        onClick={() => { setUploadingReceipt(lesson.id); fileInputRef.current?.click(); }}>
                        <Upload className="h-3.5 w-3.5" /> Anexar comprovante
                      </Button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lesson.status === "agendada" && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-accent border-accent/30 hover:bg-accent/10" onClick={() => updateStatus(lesson.id, "concluida")}><Check className="h-3.5 w-3.5" /> Realizada</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold" onClick={() => updateStatus(lesson.id, "noshow")}><UserX className="h-3.5 w-3.5" /> No-show</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-info border-info/30 hover:bg-info/10" onClick={() => updateStatus(lesson.id, "remarcada")}><RotateCcw className="h-3.5 w-3.5" /> Remarcar</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateStatus(lesson.id, "cancelada")}><XIcon className="h-3.5 w-3.5" /> Cancelar</Button>
                      </>
                    )}
                    {lesson.status === "concluida" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 text-warning border-warning/30 hover:bg-warning/10" onClick={() => updateStatus(lesson.id, "agendada")}><RotateCcw className="h-3.5 w-3.5" /> Desfazer</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-xl gap-1" onClick={() => { setDetailOpen(false); openEdit(lesson); }}><Edit className="h-3.5 w-3.5" /> Editar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-xl gap-1 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(lesson.id)}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                    {/* WhatsApp */}
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1 border-green-500/30 text-green-600 hover:bg-green-500/10" onClick={() => sendWhatsApp(lesson)}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                    {/* Calendar export */}
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1" onClick={() => exportToCalendar(lesson)}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Calendário
                    </Button>
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
                   <div><p className="text-lg font-bold">{formatHoursDisplay(selectedStudentInfo.total)}</p><p className="text-[10px] text-muted-foreground">Contratadas</p></div>
                   <div><p className="text-lg font-bold">{formatHoursDisplay(selectedStudentInfo.used)}</p><p className="text-[10px] text-muted-foreground">Abatidas</p></div>
                   <div><p className={`text-lg font-bold ${selectedStudentInfo.remaining <= 2 ? "text-destructive" : "text-accent"}`}>{formatHoursDisplay(selectedStudentInfo.remaining)}</p><p className="text-[10px] text-muted-foreground">Restantes</p></div>
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
                <div className="h-10 flex items-center justify-center rounded-xl border border-input bg-muted/50 text-sm font-bold text-primary">{formatHoursDisplay(form.duration)}</div>
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

            {/* Recurrence - only for new lessons */}
            {!editing && (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Repeat className="h-3.5 w-3.5" /> Recorrência
                </div>
                
                {!showRecurrencePreview ? (
                  <>
                    <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unica">Única</SelectItem>
                        <SelectItem value="diaria">Diária</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>

                    {form.recurrence === "semanal" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Dias da semana</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { day: 1, label: "Seg" }, { day: 2, label: "Ter" }, { day: 3, label: "Qua" },
                            { day: 4, label: "Qui" }, { day: 5, label: "Sex" }, { day: 6, label: "Sáb" }, { day: 0, label: "Dom" },
                          ].map(d => (
                            <button key={d.day} type="button"
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.recurrence_days.includes(d.day) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                              onClick={() => {
                                const days = form.recurrence_days.includes(d.day)
                                  ? form.recurrence_days.filter(x => x !== d.day)
                                  : [...form.recurrence_days, d.day];
                                setForm({ ...form, recurrence_days: days });
                              }}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.recurrence !== "unica" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Repetir até {students.find(s => s.id === form.student_id)?.enrollment_type === "pacote" && "(Opcional se houver pacote)"}</Label>
                        <Input type="date" value={form.recurrence_end} onChange={e => setForm({ ...form, recurrence_end: e.target.value })} className="h-10 rounded-xl" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                        <h3 className="text-sm font-bold text-primary">Resumo da Recorrência</h3>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg" onClick={() => setShowRecurrencePreview(false)}>Alterar</Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div className="text-muted-foreground">Pacote do aluno:</div>
                        <div className="font-bold text-right">{selectedStudentInfo ? formatHoursDisplay(selectedStudentInfo.remaining) : "N/A"}</div>
                        
                        <div className="text-muted-foreground">Duração por aula:</div>
                        <div className="font-bold text-right">{formatHoursDisplay(form.duration)}</div>
                        
                        <div className="text-muted-foreground">Aulas a serem criadas:</div>
                        <div className="font-bold text-right text-primary">{recurrencePreviewData.length}</div>
                        
                        <div className="text-muted-foreground">Total de horas:</div>
                        <div className="font-bold text-right">{formatHoursDisplay(recurrencePreviewData.length * form.duration)}</div>
                        
                        <div className="text-muted-foreground border-t border-primary/10 pt-2 mt-1">Saldo restante:</div>
                        <div className={`font-bold text-right border-t border-primary/10 pt-2 mt-1 ${recurrencePreviewData[recurrencePreviewData.length - 1].studentRemainingHours < form.duration ? "text-destructive" : "text-accent"}`}>
                          {formatHoursDisplay(recurrencePreviewData[recurrencePreviewData.length - 1].studentRemainingHours)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datas previstas</Label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {recurrencePreviewData.map((d, i) => {
                          const dt = new Date(d.date + "T12:00:00");
                          return (
                            <div key={i} className="flex items-center justify-between text-[11px] bg-muted/40 rounded-lg p-2 border border-border/50">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 flex items-center justify-center bg-primary/10 text-primary rounded-full font-bold">{i + 1}</span>
                                <span className="font-medium">{format(dt, "dd/MM/yyyy")} — <span className="capitalize">{format(dt, "EEEE", { locale: ptBR })}</span></span>
                              </div>
                              <div className="text-muted-foreground font-medium">
                                {form.time_start} às {form.time_end} ({formatHoursDisplay(form.duration)})
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
            )}
          </div>

          <div className="space-y-1.5 mt-4">
            <Label className="text-xs font-medium">Observações</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm rounded-xl" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => {
              if (showRecurrencePreview) setShowRecurrencePreview(false);
              else setDialogOpen(false);
            }}>Cancelar</Button>
            <Button className="flex-1 h-11 rounded-xl font-bold shadow-md shadow-primary/20" onClick={handleSave}>
              {showRecurrencePreview ? "Confirmar Agendamento" : (editing ? "Salvar Alterações" : "Agendar")}
            </Button>
            {editing && !showRecurrencePreview && (
              <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive h-11 rounded-xl w-12 p-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
