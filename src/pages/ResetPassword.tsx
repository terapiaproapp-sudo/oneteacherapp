import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo-oneteacher.png";
import Seo from "@/components/Seo";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  }, [password]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Senha atualizada!" });
        navigate("/login");
      }
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
        title="Redefinir senha | OneTeacher"
        description="Defina uma nova senha para sua conta OneTeacher e volte a gerenciar suas aulas com segurança."
        path="/reset-password"
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nova senha</h1>
          <p className="text-slate-500 mt-2">Crie uma senha forte para sua segurança</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-8">
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" /> Nova senha
                </Label>
                <div className="relative">
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base pr-10" 
                      placeholder="Mínimo 6 caracteres" 
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
                {password && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <span>Força da senha</span>
                      <span>{passwordStrength === 100 ? "Forte" : passwordStrength >= 50 ? "Média" : "Fraca"}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${passwordStrength}%` }}
                        className={`h-full ${passwordStrength === 100 ? "bg-emerald-500" : passwordStrength >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400" /> Confirmar nova senha
                </Label>
                <div className="relative">
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base pr-10" 
                      placeholder="Repita a nova senha" 
                    />
                  </motion.div>
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                        Salvando...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="normal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Redefinir senha
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
