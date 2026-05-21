import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";
import {
  Clock, Calendar, BookOpen, Package, Check, X, UserX,
  MessageCircle, AlertTriangle, CreditCard, TrendingUp,
  User, KeyRound, ChevronRight, Sparkles,
} from "lucide-react";
import { format, differenceInDays, differenceInHours, isToday, isTomorrow, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface StudentData { id: string; name: string; subject: string; modality: string; }
interface PackageData { id: string; hours_total: number; hours_used: number; name: string; total_value: number; status: string; }
interface LessonData { id: string; date: string; time: string; duration: number; status: string; subject: string; }
interface PaymentData { id: string; amount: number; due_date: string; status: string; installment_number: number | null; total_installments: number | null; }
interface TeacherProfile { full_name: string | null; phone: string | null; }

export default function StudentPortal() {
  const { user } = useAuth();
  const { studentAccess } = useStudentAuth();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => { if (studentAccess) loadData(); }, [studentAccess]);

  const loadData = async () => {
    if (!studentAccess) return;
    const sid = studentAccess.student_id;
    const [stuRes, pkgRes, lesRes, teacherRes] = await Promise.all([
      supabase.from("students").select("id,name,subject,modality").eq("id", sid).single(),
      supabase.from("packages").select("*").eq("student_id", sid),
      supabase.from("lessons").select("*").eq("student_id", sid).order("date", { ascending: false }),
      supabase.from("profiles").select("full_name,phone").eq("id", studentAccess.teacher_id).single(),
    ]);
    setStudent(stuRes.data);
    setPackages(pkgRes.data || []);
    setLessons((lesRes.data as any[]) || []);
    setTeacher(teacherRes.data as TeacherProfile | null);
    if (studentAccess.permissions.view_financial || studentAccess.permissions.view_payments) {
      const { data } = await supabase.from("payments").select("*").eq("student_id", sid).order("due_date");
      setPayments(data || []);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success("Senha alterada com sucesso!");
    setNewPassword("");
    setChangingPassword(false);
  };

  if (!student) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground animate-pulse">Carregando...</p></div>;

  const perms = studentAccess?.permissions;
  const activePkgs = packages.filter(p => p.status === "ativo");
  const totalHours = activePkgs.reduce((s, p) => s + p.hours_total, 0);
  const usedHours = activePkgs.reduce((s, p) => s + p.hours_used, 0);
  const remaining = totalHours - usedHours;
  const percentage = totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0;

  const today = format(new Date(), "yyyy-MM-dd");
  const allUpcoming = lessons.filter(l => l.date >= today && l.status === "agendada").reverse();
  const nextLesson = allUpcoming[0] || null;
  const completedLessons = lessons.filter(l => l.status === "concluida" || l.status === "noshow");
  const faltaCount = lessons.filter(l => l.status === "falta").length;
  const noshowCount = lessons.filter(l => l.status === "noshow").length;
  const totalAttendable = completedLessons.length + faltaCount;
  const attendanceRate = totalAttendable > 0 ? Math.round((completedLessons.filter(l => l.status === "concluida").length / totalAttendable) * 100) : 100;

  // Alerts
  const alerts: { icon: React.ReactNode; text: string; type: "warning" | "info" | "danger" }[] = [];

  if (nextLesson) {
    const lessonDate = new Date(nextLesson.date + "T" + nextLesson.time);
    const hoursUntil = differenceInHours(lessonDate, new Date());
    if (hoursUntil <= 24 && hoursUntil > 0) {
      alerts.push({ icon: <Calendar className="h-4 w-4" />, text: `Sua próxima aula é ${isToday(new Date(nextLesson.date + "T12:00:00")) ? "hoje" : "amanhã"} às ${nextLesson.time}`, type: "info" });
    }
  }

  if (perms?.view_hours && totalHours > 0 && remaining <= 2) {
    alerts.push({ icon: <Package className="h-4 w-4" />, text: `Pacote quase no fim! Restam apenas ${formatHoursDisplay(remaining)}.`, type: "warning" });
  }

  if (perms?.view_absences && faltaCount > 0) {
    const recentFalta = lessons.find(l => l.status === "falta");
    if (recentFalta) {
      const daysAgo = differenceInDays(new Date(), new Date(recentFalta.date + "T12:00:00"));
      if (daysAgo <= 7) alerts.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Ausência registrada recentemente (${format(new Date(recentFalta.date + "T12:00:00"), "dd/MM")}).`, type: "danger" });
    }
  }

  if (perms?.view_financial) {
    const pendingPayments = payments.filter(p => p.status === "pendente" && p.due_date <= today);
    if (pendingPayments.length > 0) {
      alerts.push({ icon: <CreditCard className="h-4 w-4" />, text: `Você tem ${pendingPayments.length} pagamento(s) pendente(s).`, type: "warning" });
    }
  }

  // Package end estimate
  let estimatedEnd = "";
  if (totalHours > 0 && completedLessons.length >= 2) {
    const avgDuration = completedLessons.reduce((s, l) => s + l.duration, 0) / completedLessons.length;
    if (avgDuration > 0) {
      const lessonsLeft = remaining / avgDuration;
      // avg interval between lessons
      const dates = completedLessons.map(l => new Date(l.date + "T12:00:00").getTime()).sort();
      if (dates.length >= 2) {
        const avgInterval = (dates[dates.length - 1] - dates[0]) / (dates.length - 1);
        const daysLeft = Math.round((lessonsLeft * avgInterval) / (1000 * 60 * 60 * 24));
        const endDate = addDays(new Date(), daysLeft);
        estimatedEnd = format(endDate, "dd/MM/yyyy");
      }
    }
  }

  const statusLabel = (s: string) => ({ agendada: "Agendada", concluida: "Realizada", cancelada: "Cancelada", falta: "Falta", noshow: "No-show", remarcada: "Remarcada" }[s] || s);
  const statusStyle = (s: string) => ({
    agendada: "bg-primary/10 text-primary border-primary/20",
    concluida: "bg-accent/10 text-accent border-accent/20",
    cancelada: "bg-destructive/10 text-destructive border-destructive/20",
    falta: "bg-warning/10 text-warning border-warning/20",
    noshow: "bg-destructive/10 text-destructive border-destructive/20",
    remarcada: "bg-muted text-muted-foreground border-border/30",
  }[s] || "bg-muted text-muted-foreground");

  const statusDot = (s: string) => ({
    concluida: "bg-accent",
    falta: "bg-warning",
    noshow: "bg-destructive",
    agendada: "bg-primary",
    cancelada: "bg-muted-foreground",
  }[s] || "bg-muted-foreground");

  const openWhatsApp = () => {
    if (!teacher?.phone) { toast.error("Telefone da professora não cadastrado."); return; }
    const phone = teacher.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá, sou ${student.name}, aluno(a) de ${student.subject || "aulas particulares"}. Gostaria de falar sobre minhas aulas.`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  // Dynamic greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Dynamic message
  let dynamicMsg = "";
  if (nextLesson) {
    const d = new Date(nextLesson.date + "T12:00:00");
    if (isToday(d)) dynamicMsg = `Você tem aula hoje às ${nextLesson.time} 📚`;
    else if (isTomorrow(d)) dynamicMsg = `Você tem aula amanhã às ${nextLesson.time} 📚`;
    else dynamicMsg = `Próxima aula: ${format(d, "dd/MM (EEE)", { locale: ptBR })} às ${nextLesson.time}`;
  } else if (remaining > 0) {
    dynamicMsg = `Faltam ${formatHoursDisplay(remaining)} para finalizar seu pacote`;
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto animate-fade-in pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}, {student.name.split(" ")[0]}! 👋</h1>
        <p className="text-sm text-muted-foreground">{student.subject || "Aluno"} · {student.modality}</p>
        {dynamicMsg && <p className="text-xs text-primary font-medium mt-1">{dynamicMsg}</p>}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium ${
              a.type === "danger" ? "bg-destructive/8 border-destructive/20 text-destructive" :
              a.type === "warning" ? "bg-warning/8 border-warning/20 text-warning" :
              "bg-primary/8 border-primary/20 text-primary"
            }`}>
              {a.icon}
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next lesson highlight */}
      {perms?.view_schedule && nextLesson && (
        <Card className="card-premium border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Próxima Aula</div>
            <p className="text-lg font-bold">
              {format(new Date(nextLesson.date + "T12:00:00"), "dd 'de' MMMM (EEEE)", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>🕐 {nextLesson.time}</span>
              <span>📖 {nextLesson.subject || student.subject || "Aula"}</span>
              <span>⏱ {formatHoursDisplay(nextLesson.duration)}</span>
            </div>
            <Badge variant="outline" className={`text-[10px] mt-1 ${statusStyle(nextLesson.status)}`}>{statusLabel(nextLesson.status)}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Package evolution */}
      {perms?.view_hours && totalHours > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-primary"><Package className="h-4 w-4" /> Meu Pacote</div>
              {estimatedEnd && <span className="text-[10px] text-muted-foreground">Previsão: {estimatedEnd}</span>}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-bold">{formatHoursDisplay(totalHours)}</p><p className="text-xs text-muted-foreground">Contratadas</p></div>
              <div><p className="text-2xl font-bold">{formatHoursDisplay(usedHours)}</p><p className="text-xs text-muted-foreground">Utilizadas</p></div>
              <div><p className={`text-2xl font-bold ${remaining <= 2 ? "text-destructive" : "text-accent"}`}>{formatHoursDisplay(remaining)}</p><p className="text-xs text-muted-foreground">Restantes</p></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{percentage}% consumido</span><span>{100 - percentage}% restante</span></div>
              <Progress value={percentage} className="h-2.5" />
            </div>
            {remaining > 0 && remaining <= 3 && (
              <p className="text-[11px] text-warning font-medium text-center">⚠️ Faltam {formatHoursDisplay(remaining)} para finalizar seu pacote</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student progress / Attendance stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="card-premium"><CardContent className="p-3 text-center">
          <Check className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-lg font-bold">{completedLessons.filter(l => l.status === "concluida").length}</p>
          <p className="text-[10px] text-muted-foreground">Realizadas</p>
        </CardContent></Card>
        <Card className="card-premium"><CardContent className="p-3 text-center">
          <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{attendanceRate}%</p>
          <p className="text-[10px] text-muted-foreground">Frequência</p>
        </CardContent></Card>
        {perms?.view_absences ? (
          <Card className="card-premium"><CardContent className="p-3 text-center">
            <X className="h-5 w-5 text-warning mx-auto mb-1" />
            <p className="text-lg font-bold">{faltaCount + noshowCount}</p>
            <p className="text-[10px] text-muted-foreground">Ausências</p>
          </CardContent></Card>
        ) : (
          <Card className="card-premium"><CardContent className="p-3 text-center">
            <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{allUpcoming.length}</p>
            <p className="text-[10px] text-muted-foreground">Agendadas</p>
          </CardContent></Card>
        )}
      </div>

      {/* Upcoming lessons list */}
      {perms?.view_schedule && allUpcoming.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Próximas Aulas</h2>
            {allUpcoming.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                <div>
                  <p className="text-sm font-semibold">{format(new Date(l.date + "T12:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}</p>
                  <p className="text-xs text-muted-foreground">{l.time} · {formatHoursDisplay(l.duration)} · {l.subject || "Aula"}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusStyle(l.status)}`}>{statusLabel(l.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lesson history improved */}
      {perms?.view_history && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Histórico de Aulas</h2>
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula registrada.</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {lessons.slice(0, 50).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/20">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(l.status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{format(new Date(l.date + "T12:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}</p>
                      <p className="text-[11px] text-muted-foreground">{l.time} · {formatHoursDisplay(l.duration)} · {l.subject || ""}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusStyle(l.status)}`}>{statusLabel(l.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financial */}
      {perms?.view_financial && payments.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Financeiro</h2>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/20">
                  <p className="text-xs text-muted-foreground">
                    {p.total_installments ? `Parcela ${p.installment_number}/${p.total_installments}` : "Pagamento"} · {format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy")}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">R$ {p.amount.toFixed(2)}</span>
                    <Badge variant="outline" className={`text-[10px] ${p.status === "pago" ? "bg-accent/10 text-accent border-accent/30" : "bg-warning/10 text-warning border-warning/30"}`}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact teacher */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <Button onClick={openWhatsApp} className="w-full rounded-xl gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
            <MessageCircle className="h-4 w-4" /> Falar com {teacher?.full_name?.split(" ")[0] || "professora"}
          </Button>
        </CardContent>
      </Card>

      {/* Profile section */}
      <Card className="card-premium">
        <CardContent className="p-4 space-y-3">
          <button onClick={() => setShowProfile(!showProfile)} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-bold"><User className="h-4 w-4 text-primary" /> Meu Perfil</div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showProfile ? "rotate-90" : ""}`} />
          </button>
          {showProfile && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] text-muted-foreground uppercase">Nome</p><p className="text-sm font-medium">{student.name}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase">Disciplina</p><p className="text-sm font-medium">{student.subject || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase">Modalidade</p><p className="text-sm font-medium">{student.modality || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase">E-mail</p><p className="text-sm font-medium">{user?.email || "—"}</p></div>
              </div>
              <Separator />
              {changingPassword ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-xl text-xs" onClick={handleChangePassword}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="rounded-xl text-xs" onClick={() => { setChangingPassword(false); setNewPassword(""); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1" onClick={() => setChangingPassword(true)}>
                  <KeyRound className="h-3.5 w-3.5" /> Alterar senha
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
