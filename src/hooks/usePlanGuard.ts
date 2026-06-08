import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    if (isLoading || !profile) return;

    // Public routes that don't need guard
    const publicRoutes = ["/", "/login", "/signup", "/planos"];
    if (publicRoutes.includes(location.pathname)) return;

    const today = new Date().toISOString().split("T")[0];

    // 1. Se status != 'ativo'
    if (profile.status !== "ativo") {
      toast.error("Sua assinatura está inativa.");
      navigate("/planos");
      return;
    }

    // 2. Se validade < hoje
    if (profile.validade && profile.validade < today) {
      updateStatusMutation.mutate("suspenso");
      toast.error("Sua assinatura venceu. Renove para continuar.");
      navigate("/planos");
      return;
    }
  }, [profile, isLoading, location.pathname, navigate, updateStatusMutation]);

  return { profile, isLoading };
};
