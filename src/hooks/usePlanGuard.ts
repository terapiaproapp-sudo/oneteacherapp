import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

export const usePlanGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-guard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });


  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!profile?.id) return;
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-guard"] });
    },
  });


  useEffect(() => {
    // 1. If still loading profile or mutation is active, wait
    if (isLoading || updateStatusMutation.isPending) return;

    // 2. Identify current route
    const publicRoutes = ["/", "/login", "/signup", "/planos", "/landing", "/diagnostico"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    // If it's a public route, we don't need to enforce plan restrictions
    if (isPublicRoute) return;

    // 3. Se não houver perfil (não logado), o App.tsx já cuida do redirecionamento
    // Mas se estivermos em uma rota privada e não houver perfil, retornamos
    if (!profile) return;

    // 4. Lógica de Assinatura (apenas para rotas privadas)
    const today = new Date().toISOString().split("T")[0];
    
    // Caso: Perfil sem plano ou plano pendente
    if (!profile.plan || profile.status === "pendente") {
      toast.error("Escolha um plano para continuar");
      navigate("/planos", { replace: true });
      return;
    }

    // Caso: Status não é ativo
    if (profile.status !== "ativo") {
      toast.error("Sua assinatura está inativa.");
      navigate("/planos", { replace: true });
      return;
    }

    // Caso: Assinatura expirada
    if (profile.validade && profile.validade < today) {
      updateStatusMutation.mutate("suspenso");
      toast.error("Sua assinatura venceu. Renove para continuar.");
      navigate("/planos", { replace: true });
      return;
    }
  }, [profile, isLoading, location.pathname, navigate]);


  return { profile, isLoading };
};
