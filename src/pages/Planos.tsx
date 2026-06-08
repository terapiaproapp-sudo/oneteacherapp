import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, Zap, Star, Shield, Smartphone, Clock, CalendarDays, Users, BarChart3, Package, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import logo from "@/assets/logo-oneteacher.png";

const PRODUCT_ID = "67290000-0000-0000-0000-000000000000"; // Substituir pelo UUID real da Newexy
const REDIRECT_URL = "https://oneteacherapp.lovable.app";

const plans = [
  { 
    id: "teste",
    name: "Teste", 
    price: "Grátis", 
    period: "7 dias", 
    desc: "Acesso completo", 
    highlight: false, 
    features: ["Todos os recursos", "7 dias grátis", "Sem cartão de crédito"],
    newexy_url: null 
  },
  { 
    id: "mensal",
    name: "Mensal", 
    price: "R$ 39,90", 
    period: "/mês", 
    desc: "Para quem quer começar", 
    highlight: false, 
    features: ["Alunos ilimitados", "Agenda completa", "Financeiro integrado", "Suporte por e-mail"],
    newexy_url: `https://newexyapp.lovable.app/checkout?product=${PRODUCT_ID}&plan=mensal&redirect=${REDIRECT_URL}`
  },
  { 
    id: "semestral",
    name: "Semestral", 
    price: "R$ 197,00", 
    period: "/6 meses", 
    desc: "R$ 32,83/mês · economia de 17%", 
    highlight: false, 
    features: ["Tudo do Mensal", "R$ 32,83/mês", "Prioridade no suporte"],
    newexy_url: `https://newexyapp.lovable.app/checkout?product=${PRODUCT_ID}&plan=semestral&redirect=${REDIRECT_URL}`
  },
  { 
    id: "anual",
    name: "Anual", 
    price: "R$ 347,00", 
    period: "/ano", 
    desc: "Melhor custo-benefício", 
    highlight: true, 
    features: ["Tudo do Semestral", "R$ 28,91/mês", "Economia de 27%", "Suporte prioritário"],
    newexy_url: `https://newexyapp.lovable.app/checkout?product=${PRODUCT_ID}&plan=anual&redirect=${REDIRECT_URL}`
  },
];

export default function Planos() {
  const navigate = useNavigate();
  const { profile, isLoading } = usePlanGuard();
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (plan.id === "teste") {
      if (!profile) {
        navigate("/login?redirect=/planos");
        return;
      }

      if (profile.plan) {
        toast.error("Você já utilizou ou possui um plano ativo.");
        return;
      }

      setIsActivatingTrial(true);
      const today = new Date();
      const validUntil = new Date(today.setDate(today.getDate() + 7)).toISOString().split("T")[0];

      const { error } = await supabase
        .from("profiles")
        .update({
          plan: "teste",
          status: "ativo",
          validade: validUntil
        })
        .eq("id", profile.id);

      setIsActivatingTrial(false);

      if (error) {
        toast.error("Erro ao ativar teste. Tente novamente.");
      } else {
        toast.success("Teste de 7 dias ativado!");
        navigate("/dashboard");
      }
      return;
    }

    if (plan.id) {
      // Navigate to internal checkout
      navigate(`/checkout?product=${PRODUCT_ID}&plan=${plan.id}&redirect=${REDIRECT_URL}`);
    }
  };

  const getButtonText = (planId: string) => {
    if (!profile?.plan) return planId === "teste" ? "Começar grátis" : "Assinar";
    if (profile.plan === planId) return "Renovar";
    
    const planOrder = ["teste", "mensal", "semestral", "anual"];
    const currentIdx = planOrder.indexOf(profile.plan);
    const targetIdx = planOrder.indexOf(planId);
    
    if (targetIdx > currentIdx) return "Fazer upgrade";
    return "Assinar";
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <img src={logo} alt="OneTeacher" className="h-12 object-contain cursor-pointer" onClick={() => navigate("/")} />
          {profile && (
            <div className="text-sm font-medium">
              Olá, {profile.full_name?.split(" ")[0]}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight mb-4">Planos OneTeacher</h1>
          <p className="text-muted-foreground">Escolha a melhor opção para sua carreira.</p>
          
          {profile?.plan && (
            <div className="mt-6 inline-flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <span className="text-sm font-medium">Seu plano atual: <strong className="capitalize text-primary">{profile.plan}</strong></span>
              {profile.validade && (
                <span className="text-xs text-muted-foreground italic">Válido até: {new Date(profile.validade).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative overflow-hidden transition-all duration-300 ${plan.highlight ? "border-primary shadow-lg ring-1 ring-primary/20" : "hover:border-primary/50"} ${profile?.plan === plan.id ? "bg-primary/[0.02] border-primary" : ""}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded-bl-xl">
                  Popular
                </div>
              )}
              {profile?.plan === plan.id && (
                <div className="absolute top-0 left-0 px-3 py-1 bg-accent text-accent-foreground text-[10px] font-bold uppercase rounded-br-xl">
                  Seu Plano
                </div>
              )}
              <CardContent className="p-6 flex flex-col h-full">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full rounded-xl font-semibold"
                  variant={plan.highlight || profile?.plan === plan.id ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan)}
                  disabled={isActivatingTrial && plan.id === "teste"}
                >
                  {getButtonText(plan.id)}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
