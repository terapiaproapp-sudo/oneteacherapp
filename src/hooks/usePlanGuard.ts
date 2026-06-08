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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
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

    // 3. If no profile exists (user not logged in)
    if (!profile) {
      // Only redirect to login if we are NOT on a public route
      if (!isPublicRoute) {
        navigate("/login");
      }
      return;
    }

    // 4. Lógica de Assinatura (apenas para rotas privadas)
    const today = new Date().toISOString().split("T")[0];

    // Caso: Status não é ativo
    if (profile.status !== "ativo") {
      toast.error("Sua assinatura está inativa.");
      navigate("/planos");
      return;
    }

    // Caso: Assinatura expirada
    if (profile.validade && profile.validade < today) {
      updateStatusMutation.mutate("suspenso");
      toast.error("Sua assinatura venceu. Renove para continuar.");
      navigate("/planos");
      return;
    }
  }, [profile, isLoading, location.pathname, navigate]);


  return { profile, isLoading };
};
