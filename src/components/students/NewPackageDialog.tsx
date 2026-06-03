import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import { format, addMonths } from "date-fns";
import { Loader2, Package } from "lucide-react";
import { formatMinutesToHoursInput, parseHoursToMinutes } from "@/lib/packageUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacherId: string;
  studentId: string;
  studentName: string;
  hasActivePackage: boolean;
  activePackageRemainingHours: number;
  onCreated: () => void;
}

const initial = () => ({
  package_hours: "",
  package_value: "",
  payment_method: "avista" as "avista" | "parcelado",
  installments: "",
  payment_date: format(new Date(), "yyyy-MM-dd"),
  discount_percent: "",
  start_date: format(new Date(), "yyyy-MM-dd"),
  status: "ativo" as "ativo" | "futuro" | "pendente",
  notes: "",
});

export default function NewPackageDialog({
  open, onOpenChange, teacherId, studentId, studentName,
  hasActivePackage, activePackageRemainingHours, onCreated,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(initial());
  const [loading, setLoading] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => { if (open) setForm(initial()); }, [open]);

  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const minutes = parseHoursToMinutes(form.package_hours);
  const hours = minutes / 60;
  const value = num(form.package_value);
  const discount = form.payment_method === "avista" ? num(form.discount_percent) : 0;
  const discountAmt = value * (discount / 100);
  const finalValue = Math.max(0, value - discountAmt);
  const installments = Math.max(1, Math.round(num(form.installments)) || 1);

  const handleSubmit = () => {
    if (hours <= 0) { toast({ title: "Informe as horas contratadas", variant: "destructive" }); return; }
    if (value <= 0) { toast({ title: "Informe o valor do pacote", variant: "destructive" }); return; }
    if (form.status === "ativo" && hasActivePackage && activePackageRemainingHours > 0) {
      setConflictOpen(true);
      return;
    }
    persist(form.status);
  };

  const persist = async (finalStatus: "ativo" | "futuro" | "pendente") => {
    setLoading(true);
    try {
      // Conditionally close existing active package when activating a new one
      let closedPackageId: string | null = null;
      if (finalStatus === "ativo" && hasActivePackage) {
        const { data: existing } = await supabase
          .from("packages").select("*")
          .eq("student_id", studentId).eq("status", "ativo").maybeSingle();
        if (existing) {
          await supabase.from("packages").update({ status: "encerrado" }).eq("id", existing.id);
          closedPackageId = existing.id;
          await logActivity("package_closed", {
            student_id: studentId, student_name: studentName, package_id: existing.id,
            reason: "novo pacote ativado",
          });
        }
      }

      const hourlyRate = hours > 0 ? Math.round((finalValue / hours) * 100) / 100 : 0;
      const { data: newPkg, error } = await supabase.from("packages").insert({
        teacher_id: teacherId,
        student_id: studentId,
        name: `Pacote ${formatMinutesToHoursInput(minutes)}`,
        hours_total: hours,
        hours_used: 0,
        total_value: finalValue,
        hourly_rate: hourlyRate,
        expires_at: null,
        status: finalStatus,
        // new columns (may be ignored by stale types)
        start_date: form.start_date,
        notes: form.notes,
        payment_method: form.payment_method,
      } as any).select().single();

      if (error || !newPkg) throw new Error(error?.message || "Erro ao criar pacote");

      // Payments linked to this package
      if (finalValue > 0) {
        const numInst = form.payment_method === "parcelado" ? installments : 1;
        const per = Math.round((finalValue / numInst) * 100) / 100;
        const inserts = [];
        for (let i = 0; i < numInst; i++) {
          const due = i === 0
            ? form.payment_date
            : format(addMonths(new Date(form.payment_date + "T12:00:00"), i), "yyyy-MM-dd");
          inserts.push({
            teacher_id: teacherId,
            student_id: studentId,
            amount: per,
            due_date: due,
            status: "pendente",
            payment_method: form.payment_method,
            installment_number: numInst > 1 ? i + 1 : null,
            total_installments: numInst > 1 ? numInst : null,
            package_id: newPkg.id,
            notes: form.notes || "",
          });
        }
        await supabase.from("payments").insert(inserts);
      }

      // Sync student.hours_remaining/contracted from currently active package only
      if (finalStatus === "ativo") {
        await supabase.from("students").update({
          hours_contracted: hours,
          hours_remaining: hours,
          enrollment_type: "pacote",
        }).eq("id", studentId);
      }

      await logActivity("package_created", {
        student_id: studentId, student_name: studentName,
        package_id: newPkg.id, hours, value: finalValue, status: finalStatus,
        replaced_package_id: closedPackageId,
      });
      if (finalStatus === "ativo") {
        await logActivity("package_activated", {
          student_id: studentId, package_id: newPkg.id,
        });
      }

      toast({ title: "Pacote criado com sucesso" });
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast({ title: "Erro ao criar pacote", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setConflictOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Novo pacote — {studentName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Horas contratadas</Label>
                <Input value={form.package_hours} onChange={e => setForm({ ...form, package_hours: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: 10h ou 10h30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor (R$)</Label>
                <Input type="number" value={form.package_value} onChange={e => setForm({ ...form, package_value: e.target.value })} className="h-10 rounded-xl" placeholder="0,00" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forma de pagamento</Label>
              <div className="flex bg-muted rounded-xl p-1">
                <button type="button" onClick={() => setForm({ ...form, payment_method: "avista", installments: "" })}
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${form.payment_method === "avista" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>À vista</button>
                <button type="button" onClick={() => setForm({ ...form, payment_method: "parcelado", discount_percent: "" })}
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${form.payment_method === "parcelado" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Parcelado</button>
              </div>
            </div>

            {form.payment_method === "avista" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Desconto (%)</Label>
                <Input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} className="h-10 rounded-xl" placeholder="0" />
                {discount > 0 && value > 0 && (
                  <p className="text-xs text-accent font-medium">Valor final: R$ {finalValue.toFixed(2)}</p>
                )}
              </div>
            )}

            {form.payment_method === "parcelado" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Parcelas</Label>
                <Input type="number" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} className="h-10 rounded-xl" placeholder="Ex: 3" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{form.payment_method === "parcelado" ? "Data 1ª parcela" : "Data pagamento"}</Label>
                <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data de início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status inicial</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="futuro">Futuro</SelectItem>
                  <SelectItem value="pendente">Pendente de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="rounded-xl text-sm" />
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full h-11 rounded-xl font-semibold">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Criar pacote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Aluno possui pacote ativo</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} ainda tem um pacote ativo com {activePackageRemainingHours.toFixed(2)}h restantes.
              Como deseja criar este novo pacote?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <Button variant="outline" className="rounded-xl" disabled={loading} onClick={() => persist("futuro")}>
              Criar como futuro
            </Button>
            <AlertDialogAction className="rounded-xl" disabled={loading} onClick={() => persist("ativo")}>
              Ativar agora (encerrar anterior)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}