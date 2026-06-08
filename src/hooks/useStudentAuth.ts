import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface StudentAccessPermissions {
  view_hours: boolean;
  view_schedule: boolean;
  view_history: boolean;
  view_absences: boolean;
  view_financial: boolean;
  view_payments: boolean;
}

export interface StudentAccess {
  id: string;
  student_id: string;
  user_id: string;
  teacher_id: string;
  is_active: boolean;
  permissions: StudentAccessPermissions;
}

export function useStudentAuth() {
  const { user, loading: authLoading } = useAuth();
  const [isStudent, setIsStudent] = useState(false);
  const [studentAccess, setStudentAccess] = useState<StudentAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsStudent(false); setStudentAccess(null); setLoading(false); return; }

    const check = async () => {
      try {
        const { data } = await (supabase.from as any)("student_access")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        setIsStudent(!!data);
        setStudentAccess(data);
      } catch {
        setIsStudent(false);
      }
      setLoading(false);
    };
    check();
  }, [user, authLoading]);

  return { isStudent, studentAccess, loading: loading || authLoading, user };
}
