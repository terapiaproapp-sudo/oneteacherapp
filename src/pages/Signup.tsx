import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-oneteacher.png";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast({ title: "Senhas não coincidem", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar." });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <img src={logo} alt="OneTeacher" className="h-10 mx-auto mb-6 object-contain" />
          <h1 className="text-xl font-bold text-foreground">Crie sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Comece a organizar suas aulas</p>
        </div>

        <Card className="card-premium">
          <CardContent className="p-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nome completo</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="h-10" placeholder="Seu nome" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-10" placeholder="seu@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-10" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Confirmar senha</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="h-10" placeholder="Repita a senha" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-10 rounded-lg font-medium">
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
