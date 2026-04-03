import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatHoursDisplay } from "@/lib/formatMinutes";
import { Clock, Calendar, BookOpen, Package, Check, X, UserX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentData { id: string; name: string; subject: string; modality: string; }
interface PackageData { id: string; hours_total: number; hours_used: number; name: string; total_value: number; status: string; }
interface LessonData { id: string; date: string; time: string; duration: number; status: string; subject: string; }
interface PaymentData { id: string; amount: number; due_date: string; status: string; installment_number: number | null; total_installments: number | null; }

export default function StudentPortal() {
  const { user } = useAuth();
  const { studentAccess } = useStudentAuth();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);

  useEffect(() => { if (studentAccess) loadData(); }, [studentAccess]);

  const loadData = async () => {
    if (!studentAccess) return;
    const sid = studentAccess.student_id;
    const [stuRes, pkgRes, lesRes] = await Promise.all([
      supabase.from("students").select("id,name,subject,modality").eq("id", sid).single(),
      supabase.from("packages").select("*").eq("student_id", sid),
      supabase.from("lessons").select("*").eq("student_id", sid).order("date", { ascending: false }),
    ]);
    setStudent(stuRes.data);
    setPackages(pkgRes.data || []);
    setLessons((lesRes.data as any[]) || []);
    if (studentAccess.permissions.view_financial || studentAccess.permissions.view_payments) {
      const { data } = await supabase.from("payments").select("*").eq("student_id", sid).order("due_date");
      setPayments(data || []);
    }
  };

  if (!student) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground animate-pulse">Carregando...</p></div>;

  const perms = studentAccess?.permissions;
  const activePkgs = packages.filter(p => p.status === "ativo");
  const totalHours = activePkgs.reduce((s, p) => s + p.hours_total, 0);
  const usedHours = activePkgs.reduce((s, p) => s + p.hours_used, 0);
  const remaining = totalHours - usedHours;
  const percentage = totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const upcomingLessons = lessons.filter(l => l.date >= today && l.status === "agendada").reverse();
  const completedLessons = lessons.filter(l => l.status === "concluida" || l.status === "noshow");

  const statusLabel = (s: string) => ({ agendada: "Agendada", concluida: "Realizada", cancelada: "Cancelada", falta: "Falta", noshow: "No-show", remarcada: "Remarcada" }[s] || s);
  const statusStyle = (s: string) => ({ agendada: "bg-primary/10 text-primary border-primary/20", concluida: "bg-accent/10 text-accent border-accent/20", cancelada: "bg-destructive/10 text-destructive border-destructive/20", falta: "bg-warning/10 text-warning border-warning/20", noshow: "bg-destructive/10 text-destructive border-destructive/20" }[s] || "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Olá, {student.name}! 👋</h1>
        <p className="text-sm text-muted-foreground">{student.subject || "Aluno"} · {student.modality}</p>
      </div>

      {perms?.view_hours && totalHours > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary"><Package className="h-4 w-4" /> Meu Pacote</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-bold">{formatHoursDisplay(totalHours)}</p><p className="text-xs text-muted-foreground">Contratadas</p></div>
              <div><p className="text-2xl font-bold">{formatHoursDisplay(usedHours)}</p><p className="text-xs text-muted-foreground">Utilizadas</p></div>
              <div><p className={`text-2xl font-bold ${remaining <= 2 ? "text-destructive" : "text-accent"}`}>{formatHoursDisplay(remaining)}</p><p className="text-xs text-muted-foreground">Restantes</p></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{percentage}% consumido</span><span>{100 - percentage}% restante</span></div>
              <Progress value={percentage} className="h-2.5" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="card-premium"><CardContent className="p-3 text-center">
          <Check className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-lg font-bold">{completedLessons.length}</p>
          <p className="text-[10px] text-muted-foreground">Realizadas</p>
        </CardContent></Card>
        {perms?.view_absences && (
          <>
            <Card className="card-premium"><CardContent className="p-3 text-center">
              <X className="h-5 w-5 text-warning mx-auto mb-1" />
              <p className="text-lg font-bold">{lessons.filter(l => l.status === "falta").length}</p>
              <p className="text-[10px] text-muted-foreground">Faltas</p>
            </CardContent></Card>
            <Card className="card-premium"><CardContent className="p-3 text-center">
              <UserX className="h-5 w-5 text-destructive mx-auto mb-1" />
              <p className="text-lg font-bold">{lessons.filter(l => l.status === "noshow").length}</p>
              <p className="text-[10px] text-muted-foreground">No-show</p>
            </CardContent></Card>
          </>
        )}
      </div>

      {perms?.view_schedule && upcomingLessons.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Próximas Aulas</h2>
            {upcomingLessons.slice(0, 5).map(l => (
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

      {perms?.view_history && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Histórico de Aulas</h2>
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula registrada.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {lessons.slice(0, 30).map(l => (
                  <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/20">
                    <div className="min-w-0">
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

      {perms?.view_financial && payments.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Financeiro</h2>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/20">
                  <p className="text-xs text-muted-foreground">
                    {p.total_installments ? `Parcela ${p.installment_number}/${p.total_installments}` : "Pagamento"} · {p.due_date}
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
    </div>
  );
}
