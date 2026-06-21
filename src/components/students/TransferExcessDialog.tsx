import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRightLeft, Loader2, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { parseHoursToMinutes, formatMinutesToHoursInput } from "@/lib/packageUtils";

interface PackageRow {
  id: string;
  name: string;
  hours_total: number;
  hours_used: number;
  status: string;
}

interface LessonRow {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  subject: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourcePkg: PackageRow;
  destPkg: PackageRow | null;
  studentId: string;
  studentName: string;
  onChanged: () => void;
}

export default function TransferExcessDialog({ open, onOpenChange, sourcePkg, destPkg, studentId, studentName, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"lessons" | "numeric">("lessons");
  const [numericInput, setNumericInput] = useState<string>("");
  const [step, setStep] = useState<"form" | "markOrphans">("form");
  const [orphanLessons, setOrphanLessons] = useState<LessonRow[]>([]);
  const [orphanSelected, setOrphanSelected] = useState<Record<string, boolean>>({});
  const [lastNumericHours, setLastNumericHours] = useState<number>(0);

  const excess = Math.max(0, Number(sourcePkg.hours_used || 0) - Number(sourcePkg.hours_total || 0));

  useEffect(() => {
    if (!open) return;
    setStep("form");
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lessons")
        .select("id,date,time,duration,status,subject")
        .eq("student_id", studentId)
        .eq("package_id", sourcePkg.id)
        .in("status", ["concluida", "noshow"])
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast({ title: "Erro ao buscar aulas", description: error.message, variant: "destructive" });
        setLessons([]);
      } else {
        const rows = (data || []) as LessonRow[];
        setLessons(rows);
        // Pré-selecionar aulas mais recentes SEM ultrapassar o excesso real.
        // Nunca selecionar uma aula que sozinha já passe do excesso.
        const init: Record<string, boolean> = {};
        let acc = 0;
        for (const l of rows) {
          const d = Number(l.duration || 0);
          if (acc + d <= excess + 1e-9) {
            init[l.id] = true;
            acc += d;
          }
          if (acc >= excess) break;
        }
        setSelected(init);
        // Se não há aulas vinculadas, abrir direto no modo numérico
        if (rows.length === 0) {
          setMode("numeric");
          setNumericInput(formatMinutesToHoursInput(Math.round(excess * 60)));
        } else {
          setMode("lessons");
          setNumericInput(formatMinutesToHoursInput(Math.round(Math.max(0, excess - acc) * 60)));
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, studentId, sourcePkg.id, excess, toast]);

  const selectedLessons = useMemo(() => lessons.filter((l) => selected[l.id]), [lessons, selected]);
  const selectedOrphanLessons = useMemo(() => orphanLessons.filter((l) => orphanSelected[l.id]), [orphanLessons, orphanSelected]);
  const lessonHoursSelected = useMemo(
    () => selectedLessons.reduce((acc, l) => acc + Number(l.duration || 0), 0),
    [selectedLessons]
  );
  const numericHours = useMemo(() => {
    const mins = parseHoursToMinutes(numericInput);
    return mins / 60;
  }, [numericInput]);

  const totalHoursToMove = mode === "lessons" ? lessonHoursSelected : numericHours;

  const lessonsTotalHours = useMemo(
    () => lessons.reduce((acc, l) => acc + Number(l.duration || 0), 0),
    [lessons]
  );
  const exceedsExcess =
    mode === "lessons"
      ? lessonHoursSelected > excess + 1e-9
      : numericHours > excess + 1e-9;
  const remainingExcessToFix = Math.max(0, excess - (mode === "lessons" ? lessonHoursSelected : 0));

  const sourceUsedAfter = Math.max(0, Number(sourcePkg.hours_used || 0) - totalHoursToMove);
  const destUsedAfter = destPkg ? Number(destPkg.hours_used || 0) + totalHoursToMove : 0;
  const destRemainingAfter = destPkg ? Number(destPkg.hours_total || 0) - destUsedAfter : 0;
  const destExceeds = destPkg ? destUsedAfter > Number(destPkg.hours_total || 0) : false;

  if (!destPkg) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Sem pacote ativo
            </DialogTitle>
            <DialogDescription>
              Este aluno não possui pacote ativo para receber o excesso. Crie um novo pacote antes de corrigir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const apply = async () => {
    if (mode === "lessons" && selectedLessons.length === 0) {
      toast({ title: "Selecione ao menos uma aula", variant: "destructive" });
      return;
    }
    if (mode === "numeric" && (!numericHours || numericHours <= 0)) {
      toast({ title: "Informe um valor de horas válido", variant: "destructive" });
      return;
    }
    if (exceedsExcess) {
      toast({
        title: "Seleção ultrapassa o excesso",
        description: `A seleção ultrapassa o excesso de ${formatHoursDisplay(excess)}. Para corrigir este pacote, selecione no máximo ${formatHoursDisplay(excess)} ou use ajuste numérico.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // Re-fetch ambos pacotes para snapshot consistente
      const { data: pkgs, error: pkgErr } = await supabase
        .from("packages")
        .select("id,hours_used,hours_total,status")
        .in("id", [sourcePkg.id, destPkg.id]);
      if (pkgErr) throw pkgErr;
      const src = (pkgs || []).find((p: any) => p.id === sourcePkg.id);
      const dst = (pkgs || []).find((p: any) => p.id === destPkg.id);
      if (!src || !dst) throw new Error("Pacote não encontrado");

      let movedRows: { id: string; duration: number }[] = [];
      let movedHours = 0;

      if (mode === "lessons") {
        const ids = selectedLessons.map((l) => l.id);
        const { data: moved, error: updErr } = await supabase
          .from("lessons")
          .update({ package_id: destPkg.id })
          .in("id", ids)
          .eq("package_id", sourcePkg.id)
          .select("id,duration");
        if (updErr) throw updErr;
        movedRows = (moved || []) as any;
        if (movedRows.length === 0) {
          toast({ title: "Nenhuma aula transferida", description: "As aulas já não estavam no pacote de origem.", variant: "destructive" });
          setSaving(false);
          onChanged();
          onOpenChange(false);
          return;
        }
        movedHours = movedRows.reduce((a, l: any) => a + Number(l.duration || 0), 0);
      } else {
        // Ajuste numérico — apenas saldo, sem mover aulas
        movedHours = numericHours;
      }

      const srcUsedBefore = Number(src.hours_used || 0);
      const dstUsedBefore = Number(dst.hours_used || 0);
      const srcUsedNew = Math.max(0, srcUsedBefore - movedHours);
      const dstUsedNew = dstUsedBefore + movedHours;

      const { error: e1 } = await supabase.from("packages").update({ hours_used: srcUsedNew }).eq("id", src.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("packages").update({ hours_used: dstUsedNew }).eq("id", dst.id);
      if (e2) throw e2;

      // Atualizar students.hours_remaining baseado no pacote ativo (destino)
      if (dst.status === "ativo") {
        const newRem = Math.max(0, Number(dst.hours_total || 0) - dstUsedNew);
        await supabase.from("students").update({ hours_remaining: newRem }).eq("id", studentId);
      }

      await logActivity(
        mode === "numeric" ? "package_excess_numeric_adjustment" : "package_excess_transfer",
        {
        student_id: studentId,
        student_name: studentName,
        source_package_id: src.id,
        source_package_name: sourcePkg.name,
        dest_package_id: dst.id,
        dest_package_name: destPkg.name,
        mode,
        excess_detected: excess,
        lesson_ids: movedRows.map((l: any) => l.id),
        lessons_count: movedRows.length,
        hours_transferred: movedHours,
        source_hours_used_before: srcUsedBefore,
        source_hours_used_after: srcUsedNew,
        source_hours_total: Number(src.hours_total || 0),
        dest_hours_used_before: dstUsedBefore,
        dest_hours_used_after: dstUsedNew,
        dest_hours_total: Number(dst.hours_total || 0),
        }
      );

      if (mode === "lessons") {
        const ids = selectedLessons.map((l) => l.id);
        const skipped = ids.length - movedRows.length;
        toast({
          title: "Excesso corrigido ✅",
          description: `${movedRows.length} aula(s) transferida(s) (${formatHoursDisplay(movedHours)})${skipped > 0 ? ` · ${skipped} ignorada(s)` : ""}.`,
        });
      } else {
        toast({
          title: "Saldo ajustado ✅",
          description: `${formatHoursDisplay(movedHours)} transferida(s) numericamente do pacote antigo para o novo.`,
        });
        // Buscar aulas órfãs (sem pacote, ainda não tratadas) — se houver,
        // pular para etapa de marcar como tratadas em vez de fechar.
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: orphans } = await supabase
          .from("lessons")
          .select("id,date,time,duration,status,subject")
          .eq("student_id", studentId)
          .is("package_id", null)
          .eq("lesson_type", "pacote")
          .in("status", ["concluida", "noshow"])
          .is("reconciliation_status", null)
          .lte("date", today)
          .order("date", { ascending: false });
        const rows = (orphans || []) as LessonRow[];
        if (rows.length > 0) {
          setOrphanLessons(rows);
          setOrphanSelected({});
          setLastNumericHours(movedHours);
          setStep("markOrphans");
          onChanged();
          setSaving(false);
          return;
        }
      }
      onChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const markOrphansAsTreated = async (mark: boolean) => {
    if (!mark) {
      onOpenChange(false);
      return;
    }
    const ids = selectedOrphanLessons.map((l) => l.id);
    if (ids.length === 0) {
      toast({ title: "Selecione ao menos uma aula", description: "Nenhuma aula foi marcada como tratada.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const note = `Consumo tratado por ajuste numérico de pacote em ${format(new Date(), "dd/MM/yyyy")} (${formatHoursDisplay(lastNumericHours)} · ${sourcePkg.name} → ${destPkg.name}).`;
      const { data: updated, error } = await supabase
        .from("lessons")
        .update({
          reconciliation_status: "numeric_adjustment",
          reconciliation_note: note,
          reconciled_at: new Date().toISOString(),
          reconciled_by: userData.user?.id || null,
        })
        .in("id", ids)
        .eq("student_id", studentId)
        .eq("lesson_type", "pacote")
        .in("status", ["concluida", "noshow"])
        .is("package_id", null)
        .is("reconciliation_status", null)
        .select("id,reconciliation_status,reconciliation_note,reconciled_at,reconciled_by,package_id");
      if (error) throw error;
      const updatedRows = (updated || []) as Array<{
        id: string;
        reconciliation_status: string | null;
        reconciliation_note: string | null;
        reconciled_at: string | null;
        reconciled_by: string | null;
        package_id: string | null;
      }>;
      if (updatedRows.length !== ids.length) {
        throw new Error("Nem todas as aulas selecionadas foram marcadas. Reabra o modal e tente novamente.");
      }

      const { data: validatedRows, error: validationError } = await supabase
        .from("lessons")
        .select("id,reconciliation_status,reconciliation_note,reconciled_at,reconciled_by,package_id")
        .in("id", ids);
      if (validationError) throw validationError;
      const invalidRows = (validatedRows || []).filter((lesson: any) =>
        lesson.reconciliation_status !== "numeric_adjustment" ||
        !lesson.reconciliation_note ||
        !lesson.reconciled_at ||
        lesson.package_id !== null
      );
      if (invalidRows.length > 0 || (validatedRows || []).length !== ids.length) {
        throw new Error("A validação da marcação falhou. A aula não foi removida das pendências.");
      }
      for (const lid of ids) {
        await logActivity("lesson_marked_as_reconciled_by_numeric_adjustment", {
          student_id: studentId,
          student_name: studentName,
          lesson_id: lid,
          source_package_id: sourcePkg.id,
          source_package_name: sourcePkg.name,
          dest_package_id: destPkg.id,
          dest_package_name: destPkg.name,
          hours_adjusted: lastNumericHours,
          reconciled_by: userData.user?.id || null,
        });
      }
      toast({
        title: "Aulas marcadas como tratadas ✅",
        description: `${ids.length} aula(s) não aparecerão mais como pendentes.`,
      });
      onChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao marcar aulas", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {step === "markOrphans" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Marcar aulas como tratadas?
              </DialogTitle>
              <DialogDescription>
                Existe{orphanLessons.length > 1 ? "m" : ""} <strong>{orphanLessons.length}</strong> aula{orphanLessons.length > 1 ? "s" : ""} sem pacote
                relacionada{orphanLessons.length > 1 ? "s" : ""} a este aluno. Como o excesso já foi corrigido por <strong>ajuste numérico</strong>,
                você pode marcá-la{orphanLessons.length > 1 ? "s" : ""} como tratada{orphanLessons.length > 1 ? "s" : ""} para que não apareça{orphanLessons.length > 1 ? "m" : ""} mais como pendente.
                A aula continua existindo no histórico — apenas deixa de aparecer em "aulas aguardando vínculo".
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <span className="font-medium">{selectedOrphanLessons.length} de {orphanLessons.length} selecionada(s)</span>
                <span className="text-muted-foreground">Apenas selecionadas serão tratadas</span>
              </div>
              <div className="border border-border/60 rounded-lg divide-y">
                {orphanLessons.map((l) => {
                  const end = calculateEndTime(l.time, Number(l.duration || 0));
                  return (
                    <label key={l.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={!!orphanSelected[l.id]}
                        onCheckedChange={(v) => setOrphanSelected((s) => ({ ...s, [l.id]: !!v }))}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{format(new Date(l.date + "T12:00:00"), "dd/MM/yyyy")}</span>
                          <span className="text-xs text-muted-foreground">{l.time}–{end} · {formatHoursDisplay(Number(l.duration || 0))}</span>
                          {l.subject && <span className="text-xs text-muted-foreground truncate">· {l.subject}</span>}
                        </div>
                        <div className="mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-muted text-muted-foreground border-border">sem pacote</Badge>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Marcar como tratada <strong>não</strong> vincula a aula ao pacote, não altera consumo, financeiro ou pagamentos. Apenas registra que o consumo já foi resolvido pelo ajuste numérico.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => markOrphansAsTreated(false)} disabled={saving}>
                Não, manter pendente
              </Button>
              <Button onClick={() => markOrphansAsTreated(true)} disabled={saving || selectedOrphanLessons.length === 0}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Marcando…</> : "Sim, marcar como tratada"}
              </Button>
            </DialogFooter>
          </>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Corrigir excesso de consumo
          </DialogTitle>
          <DialogDescription>
            Transferir aulas excedentes de <strong>{sourcePkg.name}</strong> para <strong>{destPkg.name}</strong>.
            Aulas mais recentes são pré-selecionadas para cobrir o excesso de <strong>{formatHoursDisplay(excess)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando aulas…
            </div>
          ) : (
            <>
              {/* Tabs de modo */}
              <div className="flex gap-2 p-1 bg-muted/40 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode("lessons")}
                  disabled={lessons.length === 0}
                  className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${mode === "lessons" ? "bg-background shadow-sm" : "text-muted-foreground"} ${lessons.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Por aulas {lessons.length > 0 && `(${lessons.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("numeric")}
                  className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${mode === "numeric" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <Calculator className="h-3 w-3" /> Ajuste numérico
                </button>
              </div>

              {mode === "lessons" && lessons.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma aula está vinculada ao pacote antigo. Use o modo <strong>Ajuste numérico</strong> para transferir só o saldo.
                  </AlertDescription>
                </Alert>
              )}

              {mode === "lessons" && lessons.length > 0 && (
              <div className="border border-border/60 rounded-lg divide-y">
                {lessons.map((l) => {
                  const end = calculateEndTime(l.time, Number(l.duration || 0));
                  return (
                    <label key={l.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={!!selected[l.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [l.id]: !!v }))}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">
                            {format(new Date(l.date + "T12:00:00"), "dd/MM/yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {l.time}–{end} · {formatHoursDisplay(Number(l.duration || 0))}
                          </span>
                          {l.subject && <span className="text-xs text-muted-foreground truncate">· {l.subject}</span>}
                        </div>
                        <div className="mt-0.5">
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${l.status === "concluida" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                            {l.status === "concluida" ? "Realizada" : "No-show"}
                          </Badge>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              )}

              {mode === "numeric" && (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    Reduz o consumo do pacote antigo e aumenta o do novo, sem mexer em aulas. Máximo permitido: <strong>{formatHoursDisplay(excess)}</strong> (excesso real).
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium w-32">Horas a transferir</label>
                    <Input
                      value={numericInput}
                      onChange={(e) => setNumericInput(e.target.value)}
                      placeholder="Ex: 3h ou 3h30"
                      className="h-9 text-sm flex-1"
                    />
                    <Button type="button" size="sm" variant="outline" className="h-9 text-xs" onClick={() => setNumericInput(formatMinutesToHoursInput(Math.round(excess * 60)))}>
                      Usar excesso ({formatHoursDisplay(excess)})
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1">
                  <p className="font-semibold text-sm">Pacote antigo</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contratadas</span><span>{formatHoursDisplay(sourcePkg.hours_total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Consumidas</span><span>{formatHoursDisplay(sourcePkg.hours_used)}</span></div>
                  <div className="flex justify-between text-destructive"><span>Excesso</span><span>+{formatHoursDisplay(excess)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">Após</span><span className="font-semibold">{formatHoursDisplay(sourceUsedAfter)} consumidas</span></div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1">
                  <p className="font-semibold text-sm">Pacote ativo</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contratadas</span><span>{formatHoursDisplay(destPkg.hours_total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Consumidas</span><span>{formatHoursDisplay(destPkg.hours_used)}</span></div>
                  <div className="flex justify-between text-primary"><span>A receber</span><span>+{formatHoursDisplay(totalHoursToMove)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-muted-foreground">Saldo após</span>
                    <span className={`font-semibold ${destRemainingAfter < 0 ? "text-destructive" : "text-accent"}`}>
                      {destRemainingAfter < 0 ? `-${formatHoursDisplay(Math.abs(destRemainingAfter))}` : formatHoursDisplay(destRemainingAfter)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumo da reconciliação */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Excesso real do pacote antigo</span><span className="font-semibold text-destructive">{formatHoursDisplay(excess)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Máximo permitido p/ reconciliação</span><span className="font-semibold">{formatHoursDisplay(excess)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Aulas vinculadas ao pacote antigo</span><span>{formatHoursDisplay(lessonsTotalHours)} ({lessons.length})</span></div>
                {mode === "lessons" && remainingExcessToFix > 0 && (
                  <div className="flex justify-between text-warning"><span>Faltam para fechar o excesso</span><span className="font-semibold">{formatHoursDisplay(remainingExcessToFix)} (use ajuste numérico)</span></div>
                )}
                {mode === "lessons" && lessonsTotalHours > excess && (
                  <p className="text-[11px] text-muted-foreground italic pt-1">Atenção: nem todas as aulas vinculadas devem ser usadas — limite à medida do excesso.</p>
                )}
              </div>

              {exceedsExcess && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    A seleção ultrapassa o excesso de <strong>{formatHoursDisplay(excess)}</strong>. Selecione no máximo {formatHoursDisplay(excess)} ou use <strong>Ajuste numérico</strong>.
                  </AlertDescription>
                </Alert>
              )}

              {destExceeds && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    A transferência ultrapassa o saldo do pacote ativo. Desmarque algumas aulas ou confirme mesmo assim (ficará com saldo negativo).
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={apply}
            disabled={
              saving ||
              loading ||
              exceedsExcess ||
              (mode === "lessons" ? selectedLessons.length === 0 : !numericHours || numericHours <= 0)
            }
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando…</>
            ) : mode === "lessons" ? (
              `Transferir ${selectedLessons.length} aula(s)`
            ) : (
              `Transferir ${formatHoursDisplay(numericHours || 0)}`
            )}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}