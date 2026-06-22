import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Check, ChevronRight, Zap, Star, Shield, Smartphone, Clock, CalendarDays, Users, BarChart3, Package, Percent } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import logo from "@/assets/logo-oneteacher.png";
import WhatsAppFloat from "@/components/WhatsAppFloat";

const PRODUCT_ID = "c5ea9b9b-17c3-420c-95df-08bb7950513b";
const REDIRECT_URL = "https://oneteacherapp.lovable.app";
const NEWEXY_CHECKOUT_BASE = "https://newexyapp.lovable.app/checkout";

// Whitelist de planos pagos. Qualquer valor fora desta lista é rejeitado.
const PAID_PLAN_IDS = ["mensal", "semestral", "anual"] as const;
type PaidPlanId = typeof PAID_PLAN_IDS[number];
const isPaidPlan = (v: unknown): v is PaidPlanId =>
  typeof v === "string" && (PAID_PLAN_IDS as readonly string[]).includes(v);

// Chave usada para preservar a escolha do plano durante o cadastro/login.
const PENDING_PLAN_KEY = "oneteacher.pendingPlan";

function buildNewexyUrl(planId: PaidPlanId): string {
  const params = new URLSearchParams({
    product: PRODUCT_ID,
    plan: planId,
    redirect: REDIRECT_URL,
  });
  return `${NEWEXY_CHECKOUT_BASE}?${params.toString()}`;
}

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
  },
  { 
    id: "semestral",
    name: "Semestral", 
    price: "R$ 197,00", 
    period: "/6 meses", 
    desc: "R$ 32,83/mês · economia de 17%", 
    highlight: false, 
    features: ["Tudo do Mensal", "R$ 32,83/mês", "Prioridade no suporte"],
  },
  { 
    id: "anual",
    name: "Anual", 
    price: "R$ 347,00", 
    period: "/ano", 
    desc: "Melhor custo-benefício", 
    highlight: true, 
    features: ["Tudo do Semestral", "R$ 28,91/mês", "Economia de 27%", "Suporte prioritário"],
  },
];

export default function Planos() {
  const navigate = useNavigate();
  const { profile, isLoading } = usePlanGuard();
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Se o usuário voltar autenticado e havia uma escolha pendente em sessionStorage
  // (ou parâmetro ?plan=), retoma o redirecionamento ao checkout oficial.
  useEffect(() => {
    if (isLoading || !profile?.email) return;
    const queryPlan = searchParams.get("plan");
    const stored = typeof window !== "undefined"
      ? window.sessionStorage.getItem(PENDING_PLAN_KEY)
      : null;
    const candidate = queryPlan ?? stored;
    if (isPaidPlan(candidate)) {
      window.sessionStorage.removeItem(PENDING_PLAN_KEY);
      if (queryPlan) {
        searchParams.delete("plan");
        setSearchParams(searchParams, { replace: true });
      }
      window.location.href = buildNewexyUrl(candidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, profile?.email]);

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (plan.id === "teste") {
      if (!profile) {
        // Usuário não autenticado ou perfil ainda carregando → manda cadastrar
        if (isLoading) {
          toast.info("Carregando seu perfil, tente novamente em instantes.");
          return;
        }
        navigate("/cadastro");
        return;
      }

      if (profile.plan) {
        toast.error("Você já utilizou ou possui um plano ativo.");
        return;
      }

      setIsActivatingTrial(true);
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 7);
      const validUntil = validUntilDate.toISOString().split("T")[0];

      const { error } = await supabase
        .from("profiles")
        .update({
          plan: "teste",
          status: "ativo",
          validade: validUntil
        })
        .eq("id", profile.id);

      if (error) {
        setIsActivatingTrial(false);
        console.error("Erro ao ativar trial:", error);
        toast.error("Erro ao ativar teste. Tente novamente.");
        return;
      }

      // Invalida e refaz o fetch do profile antes de navegar, senão o
      // usePlanGuard do /dashboard lê cache antigo (plan=null) e redireciona
      // de volta para /planos.
      await queryClient.invalidateQueries({ queryKey: ["profile-guard"] });
      await queryClient.refetchQueries({ queryKey: ["profile-guard"] });
      setIsActivatingTrial(false);
      toast.success("Teste de 7 dias ativado!");
      navigate("/dashboard", { replace: true });
      return;
    }

    // Plano pago — exige whitelist + autenticação + perfil com e-mail válido
    if (!isPaidPlan(plan.id)) {
      toast.error("Plano inválido.");
      return;
    }

    if (!profile) {
      // Não autenticado → guarda escolha e envia para cadastro.
      try {
        window.sessionStorage.setItem(PENDING_PLAN_KEY, plan.id);
      } catch { /* sessionStorage indisponível */ }
      toast.info("Crie sua conta para continuar.");
      navigate(`/cadastro?next=/planos&plan=${plan.id}`);
      return;
    }

    if (!profile.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) {
      toast.error("Seu perfil está sem e-mail válido. Atualize antes de continuar.");
      return;
    }

    window.location.href = buildNewexyUrl(plan.id);
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
          <div className="flex items-center gap-4">
            <img src={logo} alt="OneTeacher" className="h-12 object-contain cursor-pointer" onClick={() => navigate("/")} />
            {profile?.plan && profile?.status === "ativo" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            )}
          </div>
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
      <WhatsAppFloat />
    </div>
  );
}
