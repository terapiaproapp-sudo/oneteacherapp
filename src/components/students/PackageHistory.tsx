import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MoreVertical, Play, X, CheckCircle2, Link2, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { formatHoursDisplay } from "@/lib/formatMinutes";
import { statusBadgeClasses, statusLabel } from "@/lib/packageUtils";
import { format } from "date-fns";
import ReconcilePackageDialog from "./ReconcilePackageDialog";
import TransferExcessDialog from "./TransferExcessDialog";

interface PackageRow {
  id: string; name: string; hours_total: number; hours_used: number;
  total_value: number; status: string; created_at?: string;
  start_date?: string | null; payment_method?: string | null;
}

interface Props {
  studentId: string;
  studentName: string;
  packages: PackageRow[];
  onChanged: () => void;
}

export default function PackageHistory({ studentId, studentName, packages, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [reconcilePkg, setReconcilePkg] = useState<PackageRow | null>(null);
  const [transferPkg, setTransferPkg] = useState<PackageRow | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const loadPendingCount = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .is("package_id", null)
      .eq("lesson_type", "pacote")
      .in("status", ["concluida", "noshow"])
      .lte("date", today);
    setPendingCount(count || 0);
  };

  useEffect(() => { loadPendingCount(); /* eslint-disable-next-line */ }, [studentId, packages]);

  const updateStatus = async (pkg: PackageRow, next: string) => {
    setBusy(true);
    try {
      // When activating: ensure no other active exists (close previous)
      if (next === "ativo") {
        const { data: current } = await supabase
          .from("packages").select("*")
          .eq("student_id", studentId).eq("status", "ativo").neq("id", pkg.id);
        for (const c of current || []) {
          await supabase.from("packages").update({ status: "encerrado" }).eq("id", c.id);
          await logActivity("package_closed", { student_id: studentId, package_id: c.id, reason: "ativação manual de outro pacote" });
        }
      }
      await supabase.from("packages").update({ status: next }).eq("id", pkg.id);
      await logActivity(`package_${next === "ativo" ? "activated" : next === "encerrado" ? "closed" : next === "cancelado" ? "cancelled" : "updated"}`,
        { student_id: studentId, student_name: studentName, package_id: pkg.id });

      if (next === "ativo") {
        const remaining = Math.max(0, pkg.hours_total - pkg.hours_used);
        await supabase.from("students").update({
          hours_contracted: pkg.hours_total,
          hours_remaining: remaining,
          enrollment_type: "pacote",
        }).eq("id", studentId);
      }
      toast({ title: "Pacote atualizado" });
      onChanged();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!packages || packages.length === 0) {
    return (
      <div className="py-6 text-center bg-muted/20 rounded-xl border border-dashed border-border">
        <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Nenhum pacote no histórico.</p>
      </div>
    );
  }

  const sorted = [...packages].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const activePkg = packages.find((p) => p.status === "ativo") || null;

  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const remaining = Math.max(0, p.hours_total - p.hours_used);
        const isClosed = p.status === "encerrado" || p.status === "concluido" || p.status === "cancelado";
        const isActive = p.status === "ativo";
        const excess = Math.max(0, Number(p.hours_used || 0) - Number(p.hours_total || 0));
        const hasExcess = excess > 0;
        return (
          <div key={p.id} className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${statusBadgeClasses(p.status)}`}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {p.created_at ? `Criado em ${format(new Date(p.created_at), "dd/MM/yyyy")}` : ""}
                  {p.start_date ? ` · Início ${format(new Date(p.start_date + "T12:00:00"), "dd/MM/yyyy")}` : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={busy}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {p.status !== "ativo" && !isClosed && (
                    <DropdownMenuItem onClick={() => updateStatus(p, "ativo")}>
                      <Play className="h-4 w-4 mr-2" /> Ativar
                    </DropdownMenuItem>
                  )}
                  {p.status === "ativo" && (
                    <>
                      <DropdownMenuItem onClick={() => setReconcilePkg(p)}>
                        <Link2 className="h-4 w-4 mr-2" /> Conciliar consumo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(p, "encerrado")}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Encerrar
                      </DropdownMenuItem>
                    </>
                  )}
                  {hasExcess && (
                    <DropdownMenuItem onClick={() => setTransferPkg(p)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" /> Corrigir excesso de consumo
                    </DropdownMenuItem>
                  )}
                  {!isClosed && (
                    <DropdownMenuItem onClick={() => updateStatus(p, "cancelado")} className="text-destructive">
                      <X className="h-4 w-4 mr-2" /> Cancelar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-muted-foreground">Contratadas</p>
                <p className="font-semibold">{formatHoursDisplay(p.hours_total)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Consumidas</p>
                <p className={`font-semibold ${hasExcess ? "text-destructive" : ""}`}>{formatHoursDisplay(p.hours_used)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Restantes</p>
                <p className="font-semibold text-accent">{formatHoursDisplay(remaining)}</p>
              </div>
            </div>
            <div className="flex justify-between text-[11px] pt-1 border-t border-border/40">
              <span className="text-muted-foreground">R$ {p.total_value.toFixed(2)}</span>
              <span className="text-muted-foreground capitalize">{p.payment_method === "parcelado" ? "Parcelado" : "À vista"}</span>
            </div>
            {hasExcess && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Excesso de {formatHoursDisplay(excess)} consumidas</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] rounded-md gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setTransferPkg(p)}
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  Corrigir excesso
                </Button>
              </div>
            )}
            {isActive && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs rounded-lg gap-1.5"
                  onClick={() => setReconcilePkg(p)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Reconciliar consumo
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-warning/15 text-warning border-warning/30 ml-1">
                      {pendingCount} aula{pendingCount > 1 ? "s" : ""} aguardando vínculo
                    </Badge>
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {reconcilePkg && (
        <ReconcilePackageDialog
          open={!!reconcilePkg}
          onOpenChange={(v) => { if (!v) setReconcilePkg(null); }}
          pkg={reconcilePkg}
          studentId={studentId}
          studentName={studentName}
          onChanged={() => { onChanged(); loadPendingCount(); }}
        />
      )}
      {transferPkg && (
        <TransferExcessDialog
          open={!!transferPkg}
          onOpenChange={(v) => { if (!v) setTransferPkg(null); }}
          sourcePkg={transferPkg}
          destPkg={activePkg && activePkg.id !== transferPkg.id ? activePkg : null}
          studentId={studentId}
          studentName={studentName}
          onChanged={() => { onChanged(); loadPendingCount(); }}
        />
      )}
    </div>
  );
}