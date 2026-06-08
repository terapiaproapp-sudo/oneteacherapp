import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, XCircle, Info, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Diagnostic() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchProfile = async () => {
    setProfileLoading(true);
    setError(null);
    try {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(data);
    } catch (err: any) {
      console.error("Diagnostic error:", err);
      setError(err.message || "Erro ao carregar perfil");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const today = new Date().toISOString().split("T")[0];
  const isExpired = profile?.validade && profile.validade < today;
  const isActive = profile?.status === "ativo" && !isExpired;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Diagnóstico de Acesso</h1>
            <p className="text-slate-500">Ferramenta para identificar problemas na assinatura</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchProfile} disabled={profileLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${profileLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sessão de Autenticação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Info className="w-4 h-4 mr-2 text-blue-500" />
                Sessão (Auth)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Status:</span>
                {authLoading ? (
                  <Badge variant="outline" className="animate-pulse">Carregando...</Badge>
                ) : user ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Autenticado</Badge>
                ) : (
                  <Badge variant="destructive">Não autenticado</Badge>
                )}
              </div>
              {user && (
                <>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400 uppercase font-semibold">E-mail</p>
                    <p className="font-mono bg-slate-100 p-1 rounded truncate">{user.email}</p>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400 uppercase font-semibold">User ID</p>
                    <p className="font-mono bg-slate-100 p-1 rounded truncate">{user.id}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dados do Perfil */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Info className="w-4 h-4 mr-2 text-purple-500" />
                Perfil (Database)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Encontrado:</span>
                {profileLoading ? (
                  <Badge variant="outline" className="animate-pulse">Verificando...</Badge>
                ) : profile ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Sim</Badge>
                ) : error ? (
                  <Badge variant="destructive">Erro no DB</Badge>
                ) : (
                  <Badge variant="destructive">Não encontrado</Badge>
                )}
              </div>
              {profile && (
                <>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400 uppercase font-semibold">Status no DB</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.status === "ativo" ? "default" : "secondary"}>
                        {profile.status || "sem status"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400 uppercase font-semibold">Validade</p>
                    <p className={`font-medium ${isExpired ? 'text-red-500' : 'text-slate-700'}`}>
                      {profile.validade ? new Date(profile.validade).toLocaleDateString('pt-BR') : "Sem data"}
                      {isExpired && " (Vencido)"}
                    </p>
                  </div>
                </>
              )}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status de Acesso Final */}
        <Card className={`border-l-4 ${isActive ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {isActive ? (
                <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500 shrink-0" />
              )}
              <div className="space-y-1">
                <h3 className="font-bold text-lg">
                  Acesso {isActive ? 'Liberado' : 'Bloqueado'}
                </h3>
                <p className="text-slate-600 text-sm">
                  {isActive 
                    ? "Seus dados estão corretos. Se ainda não consegue acessar, tente limpar o cache do navegador."
                    : !user 
                      ? "Você não está logado. Por favor, faça login."
                      : !profile 
                        ? "Seu perfil não foi criado corretamente no banco de dados."
                        : isExpired 
                          ? "Sua assinatura expirou no dia " + new Date(profile.validade).toLocaleDateString('pt-BR') + "."
                          : "Seu status atual é '" + profile.status + "'. Ele precisa ser 'ativo' para liberar o acesso."}
                </p>
              </div>
            </div>
            {!isActive && user && (
              <div className="mt-6 flex gap-3">
                <Button onClick={() => navigate("/planos")} className="flex-1">
                  Ver Planos
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")} className="flex-1">
                  Voltar para Login
                </Button>
              </div>
            )}
            {isActive && (
               <div className="mt-6">
                 <Button onClick={() => navigate("/dashboard")} className="w-full bg-green-600 hover:bg-green-700">
                   Ir para o Dashboard
                 </Button>
               </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-slate-100 rounded-lg p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Resumo Técnico (JSON)</h4>
          <pre className="text-[10px] overflow-auto max-h-40 p-2 bg-slate-900 text-slate-300 rounded">
            {JSON.stringify({
              auth: { id: user?.id, email: user?.email, loading: authLoading },
              profile: profile,
              system: { 
                today, 
                isActive, 
                isExpired,
                pathname: window.location.pathname
              }
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
