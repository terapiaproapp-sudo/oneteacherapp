import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { formatHoursDisplay, calculateEndTime } from "@/lib/formatMinutes";
import { format } from "date-fns";

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

  const excess = Math.max(0, Number(sourcePkg.hours_used || 0) - Number(sourcePkg.hours_total || 0));

  useEffect(() => {
    if (!open) return;
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
        // Pré-selecionar aulas mais recentes até cobrir o excesso
        const init: Record<string, boolean> = {};
        let acc = 0;
        for (const l of rows) {
          if (acc >= excess) break;
          init[l.id] = true;
          acc += Number(l.duration || 0);
        }
        setSelected(init);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, studentId, sourcePkg.id, excess, toast]);

  const selectedLessons = useMemo(() => lessons.filter((l) => selected[l.id]), [lessons, selected]);
  const totalHoursToMove = useMemo(
    () => selectedLessons.reduce((acc, l) => acc + Number(l.duration || 0), 0),
    [selectedLessons]
  );

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
    if (selectedLessons.length === 0) {
      toast({ title: "Selecione ao menos uma aula", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ids = selectedLessons.map((l) => l.id);

      // Re-fetch ambos pacotes para snapshot consistente
      const { data: pkgs, error: pkgErr } = await supabase
        .from("packages")
        .select("id,hours_used,hours_total,status")
        .in("id", [sourcePkg.id, destPkg.id]);
      if (pkgErr) throw pkgErr;
      const src = (pkgs || []).find((p: any) => p.id === sourcePkg.id);
      const dst = (pkgs || []).find((p: any) => p.id === destPkg.id);
      if (!src || !dst) throw new Error("Pacote não encontrado");

      // Mover somente aulas que AINDA estão no pacote de origem (anti-duplicidade)
      const { data: moved, error: updErr } = await supabase
        .from("lessons")
        .update({ package_id: destPkg.id })
        .in("id", ids)
        .eq("package_id", sourcePkg.id)
        .select("id,duration");
      if (updErr) throw updErr;

      const movedRows = moved || [];
      if (movedRows.length === 0) {
        toast({ title: "Nenhuma aula transferida", description: "As aulas já não estavam no pacote de origem.", variant: "destructive" });
        setSaving(false);
        onChanged();
        onOpenChange(false);
        return;
      }
      const movedHours = movedRows.reduce((a, l: any) => a + Number(l.duration || 0), 0);

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

      await logActivity("package_excess_transfer", {
        student_id: studentId,
        student_name: studentName,
        source_package_id: src.id,
        source_package_name: sourcePkg.name,
        dest_package_id: dst.id,
        dest_package_name: destPkg.name,
        lesson_ids: movedRows.map((l: any) => l.id),
        lessons_count: movedRows.length,
        hours_transferred: movedHours,
        source_hours_used_before: srcUsedBefore,
        source_hours_used_after: srcUsedNew,
        source_hours_total: Number(src.hours_total || 0),
        dest_hours_used_before: dstUsedBefore,
        dest_hours_used_after: dstUsedNew,
        dest_hours_total: Number(dst.hours_total || 0),
      });

      const skipped = ids.length - movedRows.length;
      toast({
        title: "Excesso corrigido ✅",
        description: `${movedRows.length} aula(s) transferida(s) (${formatHoursDisplay(movedHours)})${skipped > 0 ? ` · ${skipped} ignorada(s)` : ""}.`,
      });
      onChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
          ) : lessons.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma aula vinculada a este pacote.
            </div>
          ) : (
            <>
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
          <Button onClick={apply} disabled={saving || loading || selectedLessons.length === 0}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando…</> : `Transferir ${selectedLessons.length} aula(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}