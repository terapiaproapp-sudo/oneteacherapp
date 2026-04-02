import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logActivity } from "@/lib/activityLogger";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-oneteacher.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast({ title: "Erro no login", description: error.message, variant: "destructive" }); return; }
    logActivity("login_realizado");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <img src={logo} alt="OneTeacher" className="h-14 sm:h-16 mx-auto mb-6 object-contain" />
          <h1 className="text-xl font-bold text-foreground">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground mt-1">Entre na sua conta para continuar</p>
        </div>

        <Card className="card-premium">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-10" placeholder="seu@email.com" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Senha</Label>
                  <Link to="/forgot-password" className="text-[11px] text-primary hover:underline">Esqueci a senha</Link>
                </div>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-10" placeholder="••••••••" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-10 rounded-lg font-medium">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Não tem conta?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
