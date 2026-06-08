import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

interface PlanBannerProps {
  profile: any;
}

export function PlanBanner({ profile }: PlanBannerProps) {
  const navigate = useNavigate();
  
  if (!profile) return null;

  const today = new Date();
  const validUntil = profile.validade ? parseISO(profile.validade) : null;
  const daysRemaining = validUntil ? differenceInDays(validUntil, today) : 0;
  const isExpired = validUntil ? validUntil < today : false;

  // Plano Teste
  if (profile.plan === "teste" && profile.status === "ativo") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">
              ⏳ Você está no plano Teste — {daysRemaining} dias restantes
            </p>
            <p className="text-xs text-amber-700">
              Assine agora para não perder o acesso e manter seus dados.
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={() => navigate("/planos")}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0"
        >
          Ver planos <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Plano Pago Ativo
  if (["mensal", "semestral", "anual"].includes(profile.plan) && profile.status === "ativo" && !isExpired) {
    const planName = profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1);
    return (
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-900">
            ✅ Plano {planName} ativo
          </p>
          {profile.validade && (
            <p className="text-xs text-emerald-700">
              Sua próxima cobrança será em {new Date(profile.validade).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Plano Vencido / Suspenso
  if (isExpired || profile.status === "suspenso") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-rose-900">
              ⚠️ Seu plano venceu
            </p>
            <p className="text-xs text-rose-700">
              Renove para continuar usando o OneTeacher e acessar seus alunos.
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={() => navigate("/planos")}
          variant="destructive"
          className="font-bold rounded-xl shrink-0"
        >
          Renovar agora <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return null;
}