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
    // 1. If still loading profile, wait
    if (isLoading) return;

    // 2. Identify current route
    const publicRoutes = ["/", "/login", "/signup", "/planos", "/landing"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    // 3. If no profile exists (user not logged in)
    if (!profile) {
      // Only redirect to login if we are NOT on a public route
      if (!isPublicRoute) {
        navigate("/login");
      }
      return;
    }

    // 4. If user is logged in but on a public route, don't guard
    if (isPublicRoute) return;

    // 5. Subscription Logic (for Private Routes only)
    const today = new Date().toISOString().split("T")[0];

    // Case: Status is not active
    if (profile.status !== "ativo") {
      toast.error("Sua assinatura está inativa.");
      navigate("/planos");
      return;
    }

    // Case: Subscription expired
    if (profile.validade && profile.validade < today) {
      updateStatusMutation.mutate("suspenso");
      toast.error("Sua assinatura venceu. Renove para continuar.");
      navigate("/planos");
      return;
    }
  }, [profile, isLoading, location.pathname, navigate]);


  return { profile, isLoading };
};
