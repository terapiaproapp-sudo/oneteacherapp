import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: "teacher" | "student" | "admin" | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<"teacher" | "student" | "admin" | null>(null)
  const initialized = useRef(false)

  const checkRole = async (userId: string) => {
    // Check if user is a student
    try {
      const { data: studentAccess } = await supabase
        .from("student_access")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (studentAccess) {
        setRole("student");
        return;
      }
    } catch (err) {
      console.error("Error checking student role:", err);
    }

    // Check admin role
    try {
      const { data: isAdmin } = await supabase.rpc("has_role", { 
        _user_id: userId, 
        _role: "admin" 
      });
      setRole(isAdmin ? "admin" : "teacher");
    } catch (err) {
      console.error("Error checking admin role:", err);
      setRole("teacher");
    }
  };

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Verifica sessão existente primeiro
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser)
      if (currentUser) {
        checkRole(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(currentUser);
        if (currentUser) {
          await checkRole(currentUser.id);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
      }

      setLoading(false);
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
