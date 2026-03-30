import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Phone, Mail, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  name: string;
  phone: string;
  email: string;
  guardian_name: string;
  guardian_phone: string;
  subject: string;
  lesson_content: string;
  modality: string;
  hourly_rate: number;
  notes: string;
  status: string;
  hours_contracted: number;
  hours_remaining: number;
  teacher_id: string;
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

  useEffect(() => {
    if (user) loadStudents();
  }, [user]);

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
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyStudent);
    loadStudents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aluno?")) return;
    await supabase.from("students").delete().eq("id", id);
    toast({ title: "Aluno excluído" });
    loadStudents();
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    const { id, teacher_id, ...rest } = student;
    setForm(rest);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyStudent);
    setDialogOpen(true);
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-muted-foreground text-sm">{students.length} aluno(s) cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Aluno</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsável financeiro</Label>
                  <Input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tel. responsável</Label>
                  <Input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Disciplina</Label>
                  <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo / matéria principal</Label>
                <Textarea value={form.lesson_content} onChange={e => setForm({ ...form, lesson_content: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor/hora (R$)</Label>
                  <Input type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Horas contratadas</Label>
                  <Input type="number" value={form.hours_contracted} onChange={e => setForm({ ...form, hours_contracted: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Horas restantes</Label>
                  <Input type="number" value={form.hours_remaining} onChange={e => setForm({ ...form, hours_remaining: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum aluno encontrado. Clique em "Novo Aluno" para começar.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.subject || "Sem disciplina"}</p>
                    </div>
                  </div>
                  <Badge variant={s.status === "ativo" ? "default" : "secondary"} className={s.status === "ativo" ? "bg-success text-success-foreground" : ""}>
                    {s.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground mb-3">
                  {s.modality && <p>📍 {s.modality}</p>}
                  {s.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</p>}
                  {s.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</p>}
                </div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span>R$ {s.hourly_rate?.toFixed(2)}/h</span>
                  <span>{s.hours_remaining || 0}h restantes de {s.hours_contracted || 0}h</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(s)}>
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
