import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo-oneteacher.png";
import Seo from "@/components/Seo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setSent(true);
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
        title="Recuperar senha | OneTeacher"
        description="Receba um link por e-mail para redefinir a senha da sua conta OneTeacher em poucos minutos."
        path="/forgot-password"
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Recuperar senha</h1>
          <p className="text-slate-500 mt-2">Enviaremos um link para você redefinir sua senha</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div 
                  key="sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-6 py-4"
                >
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-bold text-xl">E-mail enviado!</p>
                    <p className="text-slate-500">Verifique sua caixa de entrada para continuar o processo de recuperação.</p>
                  </div>
                  <Button asChild variant="outline" className="w-full h-12 rounded-xl border-slate-200">
                    <Link to="/login" className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" /> Voltar ao login
                    </Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleReset} 
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" /> E-mail de cadastro
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

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      type="submit" 
                      disabled={loading} 
                      className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </div>
                      ) : (
                        "Enviar link de recuperação"
                      )}
                    </Button>
                  </motion.div>

                  <div className="text-center">
                    <Link to="/login" className="text-slate-500 hover:text-primary font-medium flex items-center justify-center gap-2 transition-colors">
                      <ArrowLeft className="w-4 h-4" /> Voltar ao login
                    </Link>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
