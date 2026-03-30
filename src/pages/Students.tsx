import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Phone, Mail, User, BookOpen, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string; name: string; phone: string; email: string;
  guardian_name: string; guardian_phone: string; subject: string;
  lesson_content: string; modality: string; hourly_rate: number;
  notes: string; status: string; hours_contracted: number;
  hours_remaining: number; teacher_id: string;
}

const emptyStudent: Omit<Student, "id" | "teacher_id"> = {
  name: "", phone: "", email: "", guardian_name: "", guardian_phone: "",
  subject: "", lesson_content: "", modality: "online", hourly_rate: 0,
  notes: "", status: "ativo", hours_contracted: 0, hours_remaining: 0,
};

export default function Students() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyStudent);

  useEffect(() => { if (user) loadStudents(); }, [user]);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("*").eq("teacher_id", user!.id).order("name");
    setStudents(data || []);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (editing) {
      const { error } = await supabase.from("students").update(form).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aluno atualizado!" });
    } else {
      const { error } = await supabase.from("students").insert({ ...form, teacher_id: user!.id });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Aluno cadastrado!" });
    }
    setDialogOpen(false); setEditing(null); setForm(emptyStudent); loadStudents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aluno?")) return;
    await supabase.from("students").delete().eq("id", id);
    toast({ title: "Aluno excluído" }); loadStudents();
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    const { id, teacher_id, ...rest } = student;
    setForm(rest); setDialogOpen(true);
  };

  const openNew = () => { setEditing(null); setForm(emptyStudent); setDialogOpen(true); };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const statusStyle = (s: string) =>
    s === "ativo" ? "bg-accent/10 text-accent border-accent/20" :
    s === "pausado" ? "bg-warning/10 text-warning border-warning/20" :
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="section-subtitle">{students.length} cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="rounded-lg shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-3">
              {/* Personal Info */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Pessoais</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9" />
                </div>
              </fieldset>

              {/* Guardian */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Responsável Financeiro</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome</Label>
                    <Input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} className="h-9" />
                  </div>
                </div>
              </fieldset>

              {/* Academic */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Aula</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Disciplina</Label>
                    <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Modalidade</Label>
                    <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="presencial">Presencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Conteúdo da aula</Label>
                  <Textarea value={form.lesson_content} onChange={e => setForm({ ...form, lesson_content: e.target.value })} rows={2} className="text-sm" />
                </div>
              </fieldset>

              {/* Package */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pacote & Financeiro</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">R$/hora</Label>
                    <Input type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: parseFloat(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Contratadas</Label>
                    <Input type="number" value={form.hours_contracted} onChange={e => setForm({ ...form, hours_contracted: parseFloat(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Restantes</Label>
                    <Input type="number" value={form.hours_remaining} onChange={e => setForm({ ...form, hours_remaining: parseFloat(e.target.value) || 0 })} className="h-9" />
                  </div>
                </div>
              </fieldset>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="text-sm" />
              </div>

              <Button onClick={handleSave} className="w-full h-10 rounded-lg font-medium">{editing ? "Salvar Alterações" : "Cadastrar Aluno"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10 h-10 rounded-lg bg-card border-border/60" placeholder="Buscar por nome ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Students List */}
      {filtered.length === 0 ? (
        <Card className="card-premium">
          <CardContent className="py-16 text-center">
            <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Aluno" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="card-premium hover:shadow-md transition-all duration-200 group">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">{s.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{s.subject || "Sem disciplina"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusStyle(s.status)}`}>
                    {s.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-[12px] text-muted-foreground mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {s.modality}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.hours_remaining || 0}h / {s.hours_contracted || 0}h</span>
                  </div>
                  {s.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-xs font-semibold text-foreground">R$ {s.hourly_rate?.toFixed(2)}/h</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10" onClick={() => openEdit(s)}>
                      <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
