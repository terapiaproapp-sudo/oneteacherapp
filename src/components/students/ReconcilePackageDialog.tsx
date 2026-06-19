import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { formatHoursDisplay } from "@/lib/formatMinutes";
import { format } from "date-fns";

interface PackageRow {
  id: string;
  name: string;
  hours_total: number;
  hours_used: number;
  start_date?: string | null;
}

interface EligibleLesson {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  subject: string | null;
  package_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pkg: PackageRow;
  studentId: string;
  studentName: string;
  onChanged: () => void;
}

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const calcEndTime = (start: string, duration: number) => {
  if (!start) return "";
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + Math.round(duration * 60)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function ReconcilePackageDialog({ open, onOpenChange, pkg, studentId, studentName, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lessons, setLessons] = useState<EligibleLesson[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = todayStr();
      // Eligible: same student, status realizada/no-show, lesson_type=pacote,
      // package_id IS NULL (sem vínculo), data <= hoje (exclui futuras)
      const { data, error } = await supabase
        .from("lessons")
        .select("id,date,time,duration,status,subject,package_id,lesson_type")
        .eq("student_id", studentId)
        .is("package_id", null)
        .eq("lesson_type", "pacote")
        .in("status", ["concluida", "noshow"])
        .lte("date", today)
        .order("date", { ascending: true })
        .order("time", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: "Erro ao buscar aulas elegíveis", description: error.message, variant: "destructive" });
        setLessons([]);
      } else {
        const rows = (data || []) as EligibleLesson[];
        setLessons(rows);
        // Pré-selecionar todas
        const init: Record<string, boolean> = {};
        rows.forEach((l) => { init[l.id] = true; });
        setSelected(init);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, studentId, toast]);

  const selectedLessons = useMemo(() => lessons.filter((l) => selected[l.id]), [lessons, selected]);
  const totalHoursToLink = useMemo(
    () => selectedLessons.reduce((acc, l) => acc + Number(l.duration || 0), 0),
    [selectedLessons]
  );

  const remainingBefore = Math.max(0, pkg.hours_total - pkg.hours_used);
  const remainingAfter = pkg.hours_total - (pkg.hours_used + totalHoursToLink);
  const exceeds = totalHoursToLink > remainingBefore;
  const exceedsBy = exceeds ? totalHoursToLink - remainingBefore : 0;

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    lessons.forEach((l) => { next[l.id] = v; });
    setSelected(next);
  };
  const allSelected = lessons.length > 0 && selectedLessons.length === lessons.length;

  const apply = async () => {
    if (selectedLessons.length === 0) {
      toast({ title: "Nenhuma aula selecionada", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ids = selectedLessons.map((l) => l.id);

      // Re-fetch o pacote para usar hours_used mais atual e evitar sobrescrever
      const { data: pkgNow, error: pkgErr } = await supabase
        .from("packages")
        .select("id,hours_used,hours_total,status")
        .eq("id", pkg.id)
        .single();
      if (pkgErr || !pkgNow) throw new Error(pkgErr?.message || "Pacote não encontrado");

      // Atualiza somente aulas que AINDA estão sem pacote (anti-duplicidade)
      const { data: updated, error: updErr } = await supabase
        .from("lessons")
        .update({ package_id: pkg.id })
        .in("id", ids)
        .is("package_id", null)
        .select("id,duration");
      if (updErr) throw updErr;

      const actuallyLinked = updated || [];
      const linkedHours = actuallyLinked.reduce((acc, l: any) => acc + Number(l.duration || 0), 0);

      if (actuallyLinked.length === 0) {
        toast({ title: "Nenhuma aula vinculada", description: "Essas aulas já haviam sido vinculadas a outro pacote.", variant: "destructive" });
        setSaving(false);
        onChanged();
        onOpenChange(false);
        return;
      }

      const hoursBefore = Number(pkgNow.hours_used || 0);
      const hoursAfter = hoursBefore + linkedHours;

      const { error: incErr } = await supabase
        .from("packages")
        .update({ hours_used: hoursAfter })
        .eq("id", pkg.id);
      if (incErr) throw incErr;

      // Se for pacote ativo, refletir em students.hours_remaining
      if (pkgNow.status === "ativo") {
        const newRemaining = Math.max(0, Number(pkgNow.hours_total || 0) - hoursAfter);
        await supabase
          .from("students")
          .update({ hours_remaining: newRemaining })
          .eq("id", studentId);
      }

      await logActivity("package_reconciliation", {
        student_id: studentId,
        student_name: studentName,
        package_id: pkg.id,
        package_name: pkg.name,
        lesson_ids: actuallyLinked.map((l: any) => l.id),
        lessons_count: actuallyLinked.length,
        hours_linked: linkedHours,
        hours_used_before: hoursBefore,
        hours_used_after: hoursAfter,
        hours_total: Number(pkgNow.hours_total || 0),
      });

      const skipped = ids.length - actuallyLinked.length;
      toast({
        title: "Reconciliação concluída ✅",
        description: `${actuallyLinked.length} aula(s) vinculada(s) (${formatHoursDisplay(linkedHours)})${skipped > 0 ? ` · ${skipped} ignorada(s) por já estarem vinculadas` : ""}.`,
      });
      onChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao reconciliar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Reconciliar consumo do pacote
          </DialogTitle>
          <DialogDescription>
            Vincule aulas antigas já realizadas (ou no-show) a <strong>{pkg.name}</strong>.
            Só aparecem aulas <em>sem pacote</em>, do tipo pacote, com data até hoje.
            Nenhuma aula é apagada ou alterada além do vínculo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando aulas elegíveis…
            </div>
          ) : lessons.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma aula elegível encontrada. Tudo certo por aqui.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                  <span className="font-medium">Selecionar todas ({lessons.length})</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {selectedLessons.length} selecionada(s)
                </span>
              </div>

              <div className="border border-border/60 rounded-lg divide-y">
                {lessons.map((l) => {
                  const isSel = !!selected[l.id];
                  const end = calcEndTime(l.time, Number(l.duration || 0));
                  return (
                    <label key={l.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={isSel}
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
                          {l.subject && (
                            <span className="text-xs text-muted-foreground truncate">· {l.subject}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${l.status === "concluida" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                            {l.status === "concluida" ? "Realizada" : "No-show"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-muted text-muted-foreground border-border">
                            sem pacote
                          </Badge>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Pacote ativo</span><span className="font-semibold">{pkg.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Contratadas</span><span>{formatHoursDisplay(pkg.hours_total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Já consumidas</span><span>{formatHoursDisplay(pkg.hours_used)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">A vincular agora</span><span className="font-semibold text-primary">+{formatHoursDisplay(totalHoursToLink)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Saldo após reconciliação</span>
                  <span className={`font-bold ${remainingAfter < 0 ? "text-destructive" : "text-accent"}`}>
                    {remainingAfter < 0 ? `-${formatHoursDisplay(Math.abs(remainingAfter))}` : formatHoursDisplay(remainingAfter)}
                  </span>
                </div>
              </div>

              {exceeds && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Atenção: as aulas selecionadas ultrapassam o saldo deste pacote em <strong>{formatHoursDisplay(exceedsBy)}</strong>.
                    Você pode desmarcar algumas ou confirmar mesmo assim (o pacote ficará com saldo negativo).
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={apply} disabled={saving || loading || selectedLessons.length === 0}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando…</> : `Confirmar e vincular ${selectedLessons.length} aula(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}