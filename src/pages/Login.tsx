import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logActivity } from "@/lib/activityLogger";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo-oneteacher.png";
import Seo from "@/components/Seo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { 
        toast({ title: "Erro no login", description: "E-mail ou senha incorretos.", variant: "destructive" }); 
        return; 
      }
      logActivity("login_realizado");
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputVariants = {
    focus: { scale: 1.01, transition: { duration: 0.2 } },
    tap: { scale: 0.99 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <Seo
        title="Entrar | OneTeacher"
        description="Acesse sua conta OneTeacher para gerenciar alunos, pacotes de horas, agenda e pagamentos em um só lugar."
        path="/login"
      />
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <motion.img 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            src={logo} 
            alt="OneTeacher - Gestão para professores particulares"
            className="h-16 mx-auto mb-6 object-contain" 
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-500 mt-2">Entre na sua conta para continuar</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" /> E-mail
                </Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base" 
                    placeholder="seu@email.com" 
                  />
                </motion.div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" /> Senha
                  </Label>
                  <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline decoration-2">Esqueci a senha</Link>
                </div>
                <div className="relative">
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base pr-10" 
                      placeholder="••••••••" 
                    />
                  </motion.div>
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all"
                >
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entrando...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="normal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Entrar na conta
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </form>
          </CardContent>
          
          <div className="bg-slate-50/50 p-6 border-t border-slate-100 text-center">
            <p className="text-slate-600 font-medium text-sm">
              Não tem conta?{" "}
              <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">Criar conta</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
