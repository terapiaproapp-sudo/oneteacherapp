import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useAdminAuth() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); setLoading(false); return; }

    const checkRole = async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        const adminRole = roles?.some(r => r.role === "admin");
        setIsAdmin(!!adminRole);
      } catch {
        setIsAdmin(false);
      }
      setLoading(false);
    };
    checkRole();
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading, user };
}
