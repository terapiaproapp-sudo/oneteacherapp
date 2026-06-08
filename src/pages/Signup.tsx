import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Lock, Mail, User, Phone, Globe, MapPin, Building2, ShieldCheck, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from 'react-phone-number-input';
import { CountryDropdown, RegionDropdown } from 'react-country-region-selector';
import logo from "@/assets/logo-oneteacher.png";
import Seo from "@/components/Seo";

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    country: "",
    region: "",
    city: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const password = formData.password;
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  }, [formData.password]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }

    if (!formData.acceptTerms) {
      toast({ title: "Você deve aceitar os termos", variant: "destructive" });
      return;
    }

    if (!formData.whatsapp) {
      toast({ title: "WhatsApp é obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { 
          data: { 
            full_name: formData.name,
            whatsapp: formData.whatsapp,
            country: formData.country,
            region: formData.region,
            city: formData.city
          },
          emailRedirectTo: window.location.origin 
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({ title: "E-mail já cadastrado", description: "Tente fazer login ou use outro e-mail.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
        return;
      }

      toast({ title: "Conta criada!", description: "Bem-vindo ao OneTeacher." });
      navigate("/planos");
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <Seo
        title="Criar conta grátis | OneTeacher"
        description="Crie sua conta OneTeacher e teste 7 dias grátis a plataforma de gestão para professores particulares. Sem cartão de crédito."
        path="/signup"
      />
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        <div className="text-center">
          <motion.img 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            src={logo} 
            alt="OneTeacher - Gestão para professores particulares"
            className="h-16 mx-auto mb-6 object-contain" 
          />
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Crie sua conta global</h1>
          <p className="text-slate-500 mt-2 text-lg">Comece a organizar suas aulas em qualquer lugar do mundo</p>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-8 sm:p-12">
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Nome Completo */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" /> Nome completo
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      value={formData.name} 
                      onChange={e => updateField("name", e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base" 
                      placeholder="Digite seu nome" 
                    />
                  </motion.div>
                </div>

                {/* WhatsApp Internacional */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" /> WhatsApp internacional
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <PhoneInput
                      placeholder="+55 (11) 99999-9999"
                      value={formData.whatsapp}
                      onChange={val => updateField("whatsapp", val)}
                      className="flex h-12 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white transition-all custom-phone-input"
                    />
                  </motion.div>
                </div>

                {/* País */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" /> País
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <CountryDropdown
                      value={formData.country}
                      onChange={(val) => updateField("country", val)}
                      className="flex h-12 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-base focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      defaultOptionLabel="Selecione o país"
                    />
                  </motion.div>
                </div>

                {/* Estado/Região */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" /> Estado/Região
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <RegionDropdown
                      country={formData.country}
                      value={formData.region}
                      onChange={(val) => updateField("region", val)}
                      className="flex h-12 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-base focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                      defaultOptionLabel="Selecione a região"
                      blankOptionLabel="Selecione o país primeiro"
                    />
                  </motion.div>
                </div>

                {/* Cidade */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" /> Cidade
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      value={formData.city} 
                      onChange={e => updateField("city", e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base" 
                      placeholder="Ex: São Paulo" 
                    />
                  </motion.div>
                </div>

                {/* E-mail */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" /> E-mail
                  </Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                    <Input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => updateField("email", e.target.value)} 
                      required 
                      className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base" 
                      placeholder="seu@email.com" 
                    />
                  </motion.div>
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" /> Senha
                  </Label>
                  <div className="relative">
                    <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={formData.password} 
                        onChange={e => updateField("password", e.target.value)} 
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
                  {/* Password Strength Indicator */}
                  {formData.password && (
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

                {/* Confirmar Senha */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" /> Confirmar senha
                  </Label>
                  <div className="relative">
                    <motion.div variants={inputVariants} whileFocus="focus" whileTap="tap">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        value={formData.confirmPassword} 
                        onChange={e => updateField("confirmPassword", e.target.value)} 
                        required 
                        className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base pr-10" 
                        placeholder="Repita a senha" 
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
              </div>

              {/* Termos e Condições */}
              <div className="flex items-start space-x-3 pt-4">
                <Checkbox 
                  id="terms" 
                  checked={formData.acceptTerms}
                  onCheckedChange={(val) => updateField("acceptTerms", !!val)}
                  className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium text-slate-600 leading-relaxed cursor-pointer"
                  >
                    Aceito os{" "}
                    <Link to="/terms" className="text-primary hover:underline underline-offset-4">Termos de Uso</Link> e a{" "}
                    <Link to="/privacy" className="text-primary hover:underline underline-offset-4">Política de Privacidade</Link>.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 transition-all mt-4 relative overflow-hidden group"
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
                        Criando conta...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="normal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Criar conta agora
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </form>
          </CardContent>
          
          <div className="bg-slate-50/50 p-6 border-t border-slate-100 text-center">
            <p className="text-slate-600 font-medium">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">Entrar</Link>
            </p>
          </div>
        </Card>
        
        <div className="flex justify-center items-center gap-8 text-slate-400">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> Seguro
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
            <Globe className="w-4 h-4" /> Global
          </div>
        </div>
      </div>

      <style>{`
        .custom-phone-input .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          width: 100%;
          height: 100%;
          font-size: inherit;
        }
        .custom-phone-input .PhoneInputCountry {
          margin-right: 12px;
          display: flex;
          align-items: center;
        }
        .custom-phone-input .PhoneInputCountrySelectArrow {
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}
