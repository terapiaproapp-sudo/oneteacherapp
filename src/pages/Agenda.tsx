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
  UserX, Repeat, Loader2, Zap, BookOpen
} from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

// Safe date formatter: returns fallback when value is missing or invalid
// instead of throwing "RangeError: Invalid time value".
const safeFormatDate = (
  dateValue: Date | string | number | null | undefined,
  formatPattern: string,
  fallback: string = "",
  options?: Parameters<typeof format>[2]
): string => {
  if (dateValue === null || dateValue === undefined || dateValue === "") return fallback;
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (!d || isNaN(d.getTime())) return fallback;
  try {
    return format(d, formatPattern, options);
  } catch {
    return fallback;
  }
};
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";

interface Lesson {
  id: string; student_id: string; teacher_id: string; date: string;
  time: string; duration: number; subject: string; status: string;
  notes: string; modality: string; package_id: string | null;
  receipt_url?: string | null;
  lesson_type: "pacote" | "avulsa";
  amount?: number;
  payment_status?: "pendente" | "pago" | "atrasado";
  students?: { name: string; phone?: string };
  recurrence_id?: string | null;
  recurrence_config?: any | null;
  recurrence_index?: number | null;
}
interface Student { id: string; name: string; subject: string; modality: string; phone?: string; enrollment_type?: string; hourly_rate?: number; }
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
  const [lessonDetail, setLessonDetail] = useState<Lesson | null>(null);
  const [showLessonDetail, setShowLessonDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    student_id: "", date: format(new Date(), "yyyy-MM-dd"),
    time_start: "08:00", time_end: "09:00",
    duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "",
    lesson_type: "pacote" as "pacote" | "avulsa",
    amount: "" as string | number,
    payment_status: "pendente" as "pendente" | "pago" | "atrasado",
    recurrence: "unica" as string, recurrence_days: [] as number[], recurrence_end: "",
  });

  useEffect(() => { if (user) { loadLessons(); loadStudents(); loadPackages(); } }, [user, currentDate]);

  const loadStudents = async () => { const { data } = await supabase.from("students").select("id,name,subject,modality,phone,enrollment_type").eq("teacher_id", user!.id).order("name"); setStudents(data || []); };
  const loadPackages = async () => { const { data } = await supabase.from("packages").select("*").eq("teacher_id", user!.id).eq("status", "ativo"); setPackages(data || []); };
  const loadLessons = async () => {
    const start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), "yyyy-MM-dd") + "T23:59:59";
    
    const { data, error } = await supabase
      .from("lessons")
      .select("*, students(name, phone)")
      .eq("teacher_id", user!.id)
      .gte("date", start)
      .lte("date", end)
      .order("date")
      .order("time");

    if (error) {
      console.error("Erro ao carregar aulas:", error);
      return;
    }
    
    setLessons((data as any[]) || []);
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

  // Update recurrence preview in real-time
  useEffect(() => {
    if (form.recurrence !== "unica" && form.student_id && form.date) {
      const student = students.find(s => s.id === form.student_id);
      const hasPackage = student?.enrollment_type === "pacote";
      const hoursInfo = getStudentHoursInfo(form.student_id);
      const availableHours = hasPackage ? hoursInfo.remaining : null;
      
      const preview = generateRecurrenceDates(
        form.date, 
        form.recurrence, 
        form.recurrence_days, 
        form.recurrence_end,
        null,
        form.duration,
        availableHours
      );
      setRecurrencePreviewData(preview);
    } else {
      setRecurrencePreviewData([]);
      setShowRecurrencePreview(false);
    }
  }, [form.student_id, form.date, form.recurrence, form.recurrence_days, form.recurrence_end, form.duration, students, packages]);

  const [recurrenceUpdateMode, setRecurrenceUpdateMode] = useState<"none" | "this" | "next" | "all">("none");
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const validateForm = () => {
    if (!form.student_id) {
      toast({ title: "Atenção", description: "Selecione um aluno", variant: "destructive" });
      return false;
    }
    if (!form.date) {
      toast({ title: "Atenção", description: "Informe a data inicial", variant: "destructive" });
      return false;
    }
    if (!form.time_start || !form.time_end) {
      toast({ title: "Atenção", description: "Informe hora inicial e hora final", variant: "destructive" });
      return false;
    }
    if (form.duration <= 0) {
      toast({ title: "Atenção", description: "Hora final deve ser maior que hora inicial", variant: "destructive" });
      return false;
    }
    if (form.recurrence === "semanal" && form.recurrence_days.length === 0) {
      toast({ title: "Atenção", description: "Selecione pelo menos um dia da semana", variant: "destructive" });
      return false;
    }
    if (form.recurrence !== "unica") {
      const student = students.find(s => s.id === form.student_id);
      const hasPackage = student?.enrollment_type === "pacote";
      if (!hasPackage && !form.recurrence_end) {
        toast({ title: "Atenção", description: "Informe a data final da recorrência", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const checkConflicts = async (payloads: any[]) => {
    // Basic conflict check: same teacher, same date, overlapping time
    const conflicts = [];
    for (const p of payloads) {
      const dayLessons = lessons.filter(l => l.date.split("T")[0] === p.date && l.id !== editing?.id);
      for (const l of dayLessons) {
        const pStart = p.time;
        const pEnd = calculateEndTime(p.time, p.duration);
        const lStart = l.time;
        const lEnd = calculateEndTime(l.time, l.duration);
        
        if ((pStart >= lStart && pStart < lEnd) || (pEnd > lStart && pEnd <= lEnd) || (pStart <= lStart && pEnd >= lEnd)) {
          conflicts.push({ date: p.date, time: p.time, student: l.students?.name });
        }
      }
    }
    return conflicts;
  };

  const handleSave = async (forceMode?: "this" | "next" | "all") => {
    if (!validateForm()) return;
    
    const student = students.find(s => s.id === form.student_id);
    const hasPackage = student?.enrollment_type === "pacote";
    
    if (editing && editing.recurrence_id && !forceMode) {
      setShowRecurrenceDialog(true);
      return;
    }

    if (!editing && form.recurrence !== "unica" && !showRecurrencePreview) {
      setShowRecurrencePreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        student_id: form.student_id, date: form.date, time: form.time_start,
        duration: form.duration, subject: form.subject, status: form.status,
        notes: form.notes, modality: form.modality, teacher_id: user!.id,
        package_id: form.package_id || null,
        lesson_type: form.lesson_type,
        amount: form.lesson_type === "avulsa" ? Number(form.amount) || 0 : 0,
        payment_status: form.lesson_type === "avulsa" ? form.payment_status : "pendente",
      };

      if (editing) {
        if (forceMode && editing.recurrence_id) {
          const recurrenceId = editing.recurrence_id;
          let affectedCount = 0;
          
          if (forceMode === "this") {
            await supabase.from("lessons").update(payload).eq("id", editing.id);
            affectedCount = 1;
          } else if (forceMode === "next") {
            const { data: futures } = await supabase.from("lessons")
              .update({
                time: payload.time,
                duration: payload.duration,
                subject: payload.subject,
                modality: payload.modality,
                notes: payload.notes
              })
              .eq("recurrence_id", recurrenceId)
              .gte("date", editing.date)
              .neq("status", "concluida")
              .neq("status", "noshow");
            affectedCount = lessons.filter(l => l.recurrence_id === recurrenceId && l.date >= editing.date && l.status !== "concluida" && l.status !== "noshow").length;
          } else if (forceMode === "all") {
            await supabase.from("lessons")
              .update({
                time: payload.time,
                duration: payload.duration,
                subject: payload.subject,
                modality: payload.modality,
                notes: payload.notes
              })
              .eq("recurrence_id", recurrenceId)
              .neq("status", "concluida")
              .neq("status", "noshow");
            affectedCount = lessons.filter(l => l.recurrence_id === recurrenceId && l.status !== "concluida" && l.status !== "noshow").length;
          }

          // Log the action
          await supabase.from("recurrence_logs").insert({
            teacher_id: user!.id,
            recurrence_id: recurrenceId,
            action_type: `update_${forceMode}`,
            affected_count: affectedCount,
            metadata: { payload, original_lesson: editing.id }
          });

          toast({ title: "Recorrência atualizada!", description: `${affectedCount} aulas afetadas.` });
        } else {
          await supabase.from("lessons").update(payload).eq("id", editing.id);
          toast({ title: "Aula atualizada!" });
        }
      } else {
        if (form.recurrence !== "unica") {
          const recurrenceId = crypto.randomUUID();
          const recurrenceConfig = {
            type: form.recurrence,
            days: form.recurrence_days,
            end: form.recurrence_end
          };
          
          const rows = recurrencePreviewData.map((d, index) => ({ 
            ...payload, 
            date: d.date,
            recurrence_id: recurrenceId,
            recurrence_config: recurrenceConfig,
            recurrence_index: index,
            status: "agendada"
          }));

          const conflicts = await checkConflicts(rows);
          if (conflicts.length > 0) {
            const confirmMsg = `Existem ${conflicts.length} possíveis conflitos de horário. Deseja prosseguir mesmo assim?`;
            if (!confirm(confirmMsg)) {
              setIsSaving(false);
              return;
            }
          }

          const { error: insertError } = await supabase.from("lessons").insert(rows);
          if (insertError) throw insertError;

          // Log the creation
          await supabase.from("recurrence_logs").insert({
            teacher_id: user!.id,
            recurrence_id: recurrenceId,
            action_type: "create_recurrence",
            affected_count: rows.length,
            metadata: { 
              config: recurrenceConfig,
              student_id: form.student_id,
              base_date: form.date,
              time: form.time_start
            }
          });

          toast({ title: `${recurrencePreviewData.length} aulas agendadas!`, description: `Recorrência ${form.recurrence} criada.` });
        } else {
          const { error: insertError } = await supabase.from("lessons").insert(payload);
          if (insertError) throw insertError;
          toast({ title: "Aula agendada!" });
        }
      }
      
      setDialogOpen(false); 
      setEditing(null); 
      setShowRecurrencePreview(false); 
      setShowRecurrenceDialog(false);
      loadLessons(); 
      loadPackages();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    const prevStatus = lesson.status;
    const student = students.find(s => s.id === lesson.student_id);
    const pkg = lesson.package_id ? packages.find(p => p.id === lesson.package_id) : packages.find(p => p.student_id === lesson.student_id && p.status === "ativo");
    const isPackageLesson = lesson.lesson_type === "pacote";

    if (pkg && student?.enrollment_type === "pacote" && isPackageLesson) {
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
   if ((lesson.status === "concluida" || lesson.status === "noshow") && lesson.lesson_type === "pacote") {
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
      package_id: lesson.package_id || "", 
      lesson_type: lesson.lesson_type || "pacote",
      amount: lesson.amount || "",
      payment_status: lesson.payment_status || "pendente",
      recurrence: "unica", recurrence_days: [], recurrence_end: "",
    });
    setDialogOpen(true);
  };
  const openNew = (date?: string) => {
    setEditing(null);
    setShowRecurrencePreview(false);
    setForm({ student_id: "", date: date || format(new Date(), "yyyy-MM-dd"), time_start: "08:00", time_end: "09:00", duration: 1, subject: "", status: "agendada", notes: "", modality: "online", package_id: "", lesson_type: "pacote", amount: "", payment_status: "pendente", recurrence: "unica", recurrence_days: [], recurrence_end: "" });
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

  const statusStyle = (s: string) => {
    switch (s) {
      case "agendada": return "bg-red-50 text-red-600 border-red-200";
      case "concluida": return "bg-green-50 text-green-600 border-green-200";
      case "noshow": return "bg-red-900/10 text-red-900 border-red-900/20";
      case "remarcada": return "bg-orange-50 text-orange-600 border-orange-200";
      case "cancelada": return "bg-gray-100 text-gray-500 border-gray-200";
      case "falta": return "bg-yellow-50 text-yellow-600 border-yellow-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (s: string) => ({ 
    agendada: "Agendada", 
    concluida: "Realizada", 
    cancelada: "Cancelada", 
    falta: "Falta", 
    remarcada: "Remarcada", 
    noshow: "No-show" 
  }[s] || s);

  const dotColor = (s: string, type?: string) => {
    // If it's an extra lesson (avulsa), prioritize purple dot
    if (type === "avulsa") return "bg-purple-500";
    
    switch (s) {
      case "agendada": return "bg-red-500";
      case "concluida": return "bg-green-500";
      case "noshow": return "bg-red-900";
      case "remarcada": return "bg-orange-500";
      case "cancelada": return "bg-gray-400";
      case "falta": return "bg-yellow-500";
      default: return "bg-muted-foreground";
    }
  };

  const ms = startOfMonth(currentDate);
  const me = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) });

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const [viewType, setViewType] = useState<"dia" | "semana" | "mes">("dia");

  const stats = useMemo(() => {
    // Para os cards superiores, se estiver no modo Mês, usamos o mês de currentDate (o que o calendário mostra)
    // Se for dia ou semana, usamos selectedDate (se houver) ou hoje
    const referenceDate = (viewType === "mes") ? currentDate : (selectedDate || new Date());
    let filteredLessons = [];

    if (viewType === "dia") {
      filteredLessons = getLessonsForDay(referenceDate);
    } else if (viewType === "semana") {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      filteredLessons = lessons.filter(l => {
        const d = parseLocalDate(l.date);
        return d >= start && d <= end;
      });
    } else {
      // Mês: filtra tudo que pertence ao mês de currentDate
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      filteredLessons = lessons.filter(l => {
        const d = parseLocalDate(l.date);
        return d >= start && d <= end;
      });
    }

    return {
      total: filteredLessons.length,
      hours: filteredLessons.reduce((s, l) => s + l.duration, 0),
      avulsas: filteredLessons.filter(l => l.lesson_type === "avulsa").length,
      pending: filteredLessons.filter(l => l.status === "agendada").length,
      date: referenceDate
    };
  }, [lessons, selectedDate, currentDate, viewType]);

  const filteredLessonsForList = useMemo(() => {
    // Mesma lógica de sincronização para a lista lateral
    const referenceDate = (viewType === "mes") ? currentDate : (selectedDate || new Date());
    
    if (viewType === "dia") {
      return getLessonsForDay(referenceDate);
    } else if (viewType === "semana") {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      return lessons.filter(l => {
        const d = parseLocalDate(l.date);
        return d >= start && d <= end;
      });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return lessons.filter(l => {
        const d = parseLocalDate(l.date);
        return d >= start && d <= end;
      });
    }
  }, [lessons, selectedDate, currentDate, viewType]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">Sua central de aulas e operações</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-muted p-1 rounded-xl flex items-center shadow-inner">
            {(["dia", "semana", "mes"] as const).map((type) => (
              <Button
                key={type}
                variant={viewType === type ? "default" : "ghost"}
                size="sm"
                className={`rounded-lg h-8 px-4 text-xs font-bold transition-all ${viewType === type ? "shadow-sm" : ""}`}
                onClick={() => setViewType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
          <Button onClick={() => openNew()} size="sm" className="rounded-xl shadow-sm h-10 gap-2 ml-2">
            <Plus className="h-4 w-4" /> Nova Aula
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { 
            label: `Aulas n${viewType === "dia" ? "o dia" : viewType === "semana" ? "a semana" : "o mês"}`, 
            val: stats.total, 
            color: "text-red-500" 
          },
          { 
            label: `Horas n${viewType === "dia" ? "o dia" : viewType === "semana" ? "a semana" : "o mês"}`, 
            val: formatHoursDisplay(stats.hours), 
            color: "text-green-600" 
          },
          { 
            label: `Avulsas n${viewType === "dia" ? "o dia" : viewType === "semana" ? "a semana" : "o mês"}`, 
            val: stats.avulsas, 
            color: "text-purple-600" 
          },
          { label: "Pendentes de confirmação", val: stats.pending, color: "text-orange-500" },
        ].map(s => (
          <Card key={s.label} className="card-premium">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="card-premium overflow-hidden">
            <CardContent className="p-1.5 sm:p-4">
              <div className="flex items-center justify-between mb-4">
                 <div className="text-base font-bold flex items-center gap-2">
                   {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                 </div>
                 <div className="flex items-center gap-1">
                   <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                   <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
                   <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                  <div key={d} className="text-[10px] text-center text-muted-foreground font-bold uppercase py-1">{d}</div>
                ))}
                {calendarDays.map(day => {
                  const dl = getLessonsForDay(day);
                  const isTodayActive = isToday(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button 
                      key={day.toISOString()} 
                      onClick={() => handleDayClick(day)}
                      className={`relative flex flex-col items-center p-2 rounded-xl border transition-all ${
                        isTodayActive ? "bg-primary/5 ring-1 ring-primary/20 border-primary/20" : 
                        isSelected ? "bg-primary/10 border-primary/30 shadow-sm" : 
                        "bg-card border-border/40"
                      } ${!isCurrentMonth ? "opacity-30 grayscale-[0.5]" : "hover:bg-muted/50"}`}
                    >
                      <span className={`text-xs font-bold ${isTodayActive ? "text-primary" : isCurrentMonth ? "" : "text-muted-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      {dl.length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5 max-w-full">
                          {dl.length > 3 ? (
                            <span className="text-[9px] font-bold text-muted-foreground">+{dl.length}</span>
                          ) : (
                            dl.map((l, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor(l.status, l.lesson_type)}`} />)
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-premium">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center justify-between">
                <span>
                  {viewType === "dia" 
                    ? (selectedDate && !isToday(selectedDate) ? `Aulas de ${format(selectedDate, "dd/MM")}` : "Aulas de Hoje")
                    : viewType === "semana" ? "Aulas da Semana" : "Aulas do Mês"}
                </span>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {filteredLessonsForList.length} aula(s)
                </Badge>
              </h3>
              
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredLessonsForList.length > 0 ? (
                  // Grouping logic
                  Object.entries(
                    filteredLessonsForList.reduce((acc, lesson) => {
                      const dateKey = lesson.date.split("T")[0];
                      if (!acc[dateKey]) acc[dateKey] = [];
                      acc[dateKey].push(lesson);
                      return acc;
                    }, {} as Record<string, Lesson[]>)
                  )
                  .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                  .map(([date, dayLessons]) => (
                    <div key={date} className="space-y-3">
                      {viewType !== "dia" && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-px flex-1 bg-border/50"></div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">
                            {format(parseLocalDate(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </span>
                          <div className="h-px flex-1 bg-border/50"></div>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {dayLessons.map(l => {
                          const lessonDate = parseLocalDate(l.date);
                          const endTime = l.time && l.duration ? calculateEndTime(l.time, l.duration) : "--:--";
                          
                          return (
                            <div 
                              key={l.id} 
                              onClick={() => { setLessonDetail(l); setShowLessonDetail(true); }}
                              className="group relative cursor-pointer flex flex-col gap-2 p-4 rounded-2xl bg-white border border-border/80 hover:border-primary/40 hover:shadow-md transition-all duration-300"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                                      {l.time} às {endTime}
                                    </span>
                                    <Badge className={`text-[9px] font-bold px-1.5 h-4 uppercase ${statusStyle(l.status)}`} variant="outline">
                                      {statusLabel(l.status)}
                                    </Badge>
                                  </div>
                                  <p className="text-base font-black text-foreground tracking-tight leading-tight mt-1">{l.students?.name}</p>
                                </div>
                                
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="h-8 px-2 rounded-lg gap-1.5 font-bold text-[10px] uppercase shadow-sm border border-border/50" 
                                    onClick={(e) => { e.stopPropagation(); openEdit(l); }}
                                  >
                                    <Edit className="h-3 w-3" />
                                    Editar
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/10 mt-1">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Disciplina</span>
                                  <span className="text-[11px] font-semibold truncate">{l.subject || "Não informada"}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Modalidade</span>
                                  <span className="text-[11px] font-semibold capitalize">{l.modality}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Tipo</span>
                                  <span className={`text-[11px] font-bold ${l.lesson_type === "avulsa" ? "text-purple-600" : "text-primary"}`}>
                                    {l.lesson_type === "pacote" ? "Pacote" : "Avulsa"}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Duração</span>
                                  <span className="text-[11px] font-semibold">{formatHoursDisplay(l.duration)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (

                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Clock className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground">Nenhuma aula encontrada</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Experimente trocar a data ou o filtro</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Existing Dialogs kept for functionality */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }).replace(/(\d+ de )(\w)/, (m, p1, p2) => p1 + p2.toUpperCase()) : "Aulas do dia"}</DialogTitle>
            <DialogDescription>{selectedDayLessons.length} aula(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedDayLessons.map(l => (
              <div 
                key={l.id} 
                onClick={() => { setDetailOpen(false); setLessonDetail(l); setShowLessonDetail(true); }}
                className="flex items-center justify-between p-4 rounded-2xl border border-border/50 cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground truncate">{l.students?.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{l.time} · {l.subject} · {formatHoursDisplay(l.duration)}</p>
                  <Badge className={`mt-2 text-[9px] font-black uppercase tracking-wider ${statusStyle(l.status)}`} variant="outline">{statusLabel(l.status)}</Badge>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="secondary" className="h-8 px-3 rounded-xl gap-1.5 font-bold text-[10px] uppercase border border-border/50 shadow-sm" onClick={(e) => { e.stopPropagation(); setDetailOpen(false); openEdit(l); }}>
                    <Edit className="h-3 w-3" />
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => { setDetailOpen(false); openNew(selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined); }} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Nova aula
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Aula" : "Nova Aula"}</DialogTitle>
            <DialogDescription>Preencha os dados da aula</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Aluno</Label>
              <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de aula</Label>
              <Select value={form.lesson_type} onValueChange={(v: "pacote" | "avulsa") => setForm({ ...form, lesson_type: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pacote">Consumir do pacote</SelectItem>
                  <SelectItem value="avulsa">Aula avulsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                
                <div className="space-y-4">
                  <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unica">Única</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>

                  {form.recurrence !== "unica" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
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

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Repetir até {students.find(s => s.id === form.student_id)?.enrollment_type === "pacote" && "(Opcional se houver pacote)"}</Label>
                        <Input type="date" value={form.recurrence_end} onChange={e => setForm({ ...form, recurrence_end: e.target.value })} className="h-10 rounded-xl" />
                      </div>

                      {recurrencePreviewData.length > 0 && (
                        <div className="space-y-4">
                          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                            <h3 className="text-sm font-bold text-primary border-b border-primary/10 pb-2">Resumo da Recorrência</h3>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                              <div className="text-muted-foreground">Horário:</div>
                              <div className="font-bold text-right">{form.time_start} às {form.time_end}</div>

                              <div className="text-muted-foreground">Duração por aula:</div>
                              <div className="font-bold text-right">{formatHoursDisplay(form.duration)}</div>
                              
                              <div className="text-muted-foreground border-t border-primary/10 pt-2 mt-1">Quantidade de aulas:</div>
                              <div className="font-bold text-right border-t border-primary/10 pt-2 mt-1 text-primary">{recurrencePreviewData.length}</div>
                              
                              <div className="text-muted-foreground">Total de horas programadas:</div>
                              <div className="font-bold text-right text-primary">{formatHoursDisplay(recurrencePreviewData.length * form.duration)}</div>
                              
                              {selectedStudentInfo && selectedStudentInfo.total > 0 && (
                                <>
                                  <div className="text-muted-foreground border-t border-primary/10 pt-2 mt-1">Saldo restante após série:</div>
                                  <div className={`font-bold text-right border-t border-primary/10 pt-2 mt-1 ${recurrencePreviewData.length > 0 && recurrencePreviewData[recurrencePreviewData.length - 1].studentRemainingHours < 0.01 ? "text-destructive" : "text-green-600"}`}>
                                    {formatHoursDisplay(recurrencePreviewData.length > 0 ? recurrencePreviewData[recurrencePreviewData.length - 1].studentRemainingHours : 0)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datas previstas</Label>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {recurrencePreviewData.map((d, i) => {
                                const dt = d.date ? new Date(d.date + "T12:00:00") : null;
                                return (
                                  <div key={i} className="flex items-center justify-between text-[11px] bg-muted/40 rounded-lg p-2 border border-border/50">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 flex items-center justify-center bg-primary/10 text-primary rounded-full font-bold">{i + 1}</span>
                                      <span className="font-medium">{safeFormatDate(dt, "dd/MM/yyyy", "Data inválida")} — <span className="capitalize">{safeFormatDate(dt, "EEEE", "", { locale: ptBR })}</span></span>
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
                  )}
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
            <Button 
              className="flex-1 h-11 rounded-xl font-bold shadow-md shadow-primary/20" 
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {showRecurrencePreview ? "Confirmar Agendamento" : (editing ? "Salvar Alterações" : "Agendar")}
            </Button>
            {editing && !showRecurrencePreview && (
              <Button variant="outline" onClick={() => handleDelete(editing.id)} className="text-destructive h-11 rounded-xl w-12 p-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showLessonDetail} onOpenChange={setShowLessonDetail}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[24px] sm:max-w-lg shadow-2xl bg-white">
          {lessonDetail && (
            <div className="flex flex-col h-full max-h-[95vh] sm:max-h-[90vh]">
              {/* Header section - more compact and standard system colors */}
              <div className={`relative p-5 sm:p-6 ${statusStyle(lessonDetail.status).split(' ')[0]} border-b border-white/10`}>
                <div className="relative z-10 space-y-3">
                  <div className="flex justify-between items-center">
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm uppercase font-black text-[9px] px-2 py-0.5 tracking-widest rounded-full">
                      {statusLabel(lessonDetail.status)}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-white hover:bg-white/20 h-7 w-7 rounded-full transition-all" 
                      onClick={() => setShowLessonDetail(false)}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
                      {lessonDetail.students?.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/90 font-bold text-xs sm:text-sm">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 opacity-70" />
                        {lessonDetail.subject || "Sem disciplina"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarPlus className="h-3.5 w-3.5 opacity-70" />
                        {safeFormatDate(lessonDetail.date ? lessonDetail.date + "T12:00:00" : null, "dd/MM/yy", "", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 opacity-70" />
                        {lessonDetail.time} — {calculateEndTime(lessonDetail.time, lessonDetail.duration)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area - Optimized for vertical space */}
              <div className="px-5 sm:px-6 py-4 space-y-4 overflow-y-auto custom-scrollbar bg-gray-50/20">
                {/* Info Grid - 2 columns always */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">Duração e Modalidade</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-foreground">{formatHoursDisplay(lessonDetail.duration)}</span>
                      <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-lg capitalize">{lessonDetail.modality}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">Tipo de Aula</span>
                    <div className="flex items-center mt-0.5">
                      <Badge variant="secondary" className={`font-black text-[8px] tracking-widest px-2 py-0 rounded-md ${lessonDetail.lesson_type === 'pacote' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                        {lessonDetail.lesson_type === 'pacote' ? 'PACOTE' : 'AVULSA'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Package Summary - More compact */}
                {lessonDetail.lesson_type === "pacote" && lessonDetail.student_id ? (
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    {(() => {
                      const info = getStudentHoursInfo(lessonDetail.student_id);
                      return (
                        <div className="space-y-2">
                           <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                               <Package className="h-3.5 w-3.5 text-primary" />
                               <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Resumo do Pacote</span>
                             </div>
                             <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">{info.percentage}% consumido</span>
                           </div>
                           <div className="flex justify-between items-baseline">
                             <span className="text-lg font-black text-primary tracking-tighter">
                               {(info.total - info.used).toFixed(1)} <span className="text-[8px] uppercase tracking-widest ml-1 text-muted-foreground">horas restantes</span>
                             </span>
                             <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Total: {formatHoursDisplay(info.total)}</span>
                           </div>
                           <Progress value={info.percentage} className="h-1.5 bg-gray-100 rounded-full" />
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                    <Zap className="h-3.5 w-3.5 text-purple-600" />
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block leading-none">Aula Individual</span>
                      <span className="text-[10px] font-bold text-purple-700">Não consome horas do pacote</span>
                    </div>
                  </div>
                )}

                {/* Notes and Receipt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lessonDetail.notes && (
                    <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-100/30 relative min-h-[60px]">
                      <span className="text-[8px] font-black text-blue-800/60 uppercase tracking-widest block mb-1">Observações</span>
                      <p className="text-[10px] font-medium text-blue-900/70 leading-relaxed italic">"{lessonDetail.notes}"</p>
                      <FileText className="absolute bottom-2 right-2 h-3 w-3 opacity-10" />
                    </div>
                  )}

                  {lessonDetail.receipt_url && (
                    <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/30 flex flex-col justify-between">
                       <div className="flex items-center gap-2 mb-2">
                         <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                         <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">Comprovante</span>
                       </div>
                       <div className="flex gap-1.5">
                         <Button variant="ghost" size="sm" className="h-6 flex-1 text-[9px] font-black uppercase bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100 rounded-lg" onClick={() => window.open(lessonDetail.receipt_url!, '_blank')}>
                           Ver
                         </Button>
                         <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-50 rounded-lg" onClick={() => deleteReceipt(lessonDetail.id, lessonDetail.receipt_url!)}>
                           X
                         </Button>
                       </div>
                    </div>
                  )}
                </div>

                {/* Optimized Actions Area */}
                <div className="pt-2 pb-2 border-t border-gray-100 space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    <Button 
                      onClick={() => { updateStatus(lessonDetail.id, "concluida"); setShowLessonDetail(false); }}
                      className="flex-col gap-1 h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm border-none"
                    >
                      <Check className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-tight">Realizada</span>
                    </Button>
                    
                    <Button 
                      onClick={() => { updateStatus(lessonDetail.id, "noshow"); setShowLessonDetail(false); }}
                      variant="outline"
                      className="flex-col gap-1 h-16 text-red-600 border-red-100 bg-red-50/50 hover:bg-red-100 rounded-xl"
                    >
                      <UserX className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-tight">No-show</span>
                    </Button>

                    <Button 
                      onClick={() => { openEdit(lessonDetail); setShowLessonDetail(false); }}
                      variant="outline"
                      className="flex-col gap-1 h-16 border-amber-100 bg-amber-50/50 text-amber-600 hover:bg-amber-100 rounded-xl"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-tight">Remarcar</span>
                    </Button>

                    <Button 
                      onClick={() => { updateStatus(lessonDetail.id, "cancelada"); setShowLessonDetail(false); }}
                      variant="outline"
                      className="flex-col gap-1 h-16 border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      <XIcon className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-tight">Cancelar</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => { openEdit(lessonDetail); setShowLessonDetail(false); }}
                        variant="outline"
                        className="flex-1 gap-1.5 h-9 border-blue-100 bg-blue-50/30 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-[10px] uppercase tracking-wider"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button 
                        onClick={() => { handleDelete(lessonDetail.id); setShowLessonDetail(false); }}
                        variant="outline"
                        className="h-9 w-9 p-0 border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex gap-1.5">
                      <Button 
                        onClick={() => sendWhatsApp(lessonDetail)}
                        variant="outline"
                        className="flex-1 h-9 p-0 border-emerald-100 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-100 rounded-xl"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        onClick={() => exportToCalendar(lessonDetail)}
                        variant="outline"
                        className="flex-1 h-9 p-0 border-slate-200 bg-slate-50/30 text-slate-600 hover:bg-slate-100 rounded-xl"
                        title="Calendário"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="flex-1 h-9 p-0 border-indigo-100 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-100 rounded-xl"
                        title="Comprovante"
                      >
                        <Upload className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && lessonDetail) {
            handleReceiptUpload(lessonDetail.id, file);
          }
        }}
      />

      {/* Recurrence Selection Dialog */}
      <AlertDialog open={showRecurrenceDialog} onOpenChange={setShowRecurrenceDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Editar Aula Recorrente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm pt-2">
              Esta é uma aula de uma série recorrente. Como você deseja aplicar as alterações de horário, modalidade e conteúdo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="grid gap-3 py-4">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 group"
              onClick={() => handleSave("this")}
            >
              <div className="flex flex-col items-start text-left gap-1">
                <span className="font-bold text-sm group-hover:text-primary transition-colors">Apenas esta aula</span>
                <span className="text-[10px] text-muted-foreground">Altera somente o evento selecionado ({safeFormatDate(editing?.date ? editing.date + "T12:00:00" : null, "dd/MM", "—")}).</span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 group"
              onClick={() => handleSave("next")}
            >
              <div className="flex flex-col items-start text-left gap-1">
                <span className="font-bold text-sm group-hover:text-primary transition-colors">Esta e as próximas</span>
                <span className="text-[10px] text-muted-foreground">
                  Altera a aula atual e todas as futuras desta série.
                  {editing?.recurrence_id && (
                    <span className="block font-semibold text-primary/80 mt-1">
                      Afectará aproximadamente {lessons.filter(l => l.recurrence_id === editing.recurrence_id && l.date >= editing.date && l.status !== "concluida" && l.status !== "noshow").length} aulas.
                    </span>
                  )}
                </span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3 px-4 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 group"
              onClick={() => handleSave("all")}
            >
              <div className="flex flex-col items-start text-left gap-1">
                <span className="font-bold text-sm group-hover:text-primary transition-colors">Toda a recorrência</span>
                <span className="text-[10px] text-muted-foreground">Altera todos os eventos da série (mantendo histórico das realizadas).</span>
              </div>
            </Button>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
