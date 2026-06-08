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
  const [showRetry, setShowRetry] = useState(false)
  const initialized = useRef(false)

  const checkRole = async (userId: string) => {
    try {
      // Check if user is a student
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

      // Check admin role
      const { data: isAdmin } = await supabase.rpc("has_role", { 
        _user_id: userId, 
        _role: "admin" 
      });
      setRole(isAdmin ? "admin" : "teacher");
    } catch (err) {
      console.error("Error checking role:", err);
      setRole("teacher");
    }
  };

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Timeout de segurança: se em 3s não houver resposta, libera o loading
    const timeout = setTimeout(() => {
      console.warn("Auth check timed out, forcing loading false");
      setLoading(false)
    }, 3000)

    // Verifica sessão existente primeiro
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser)
      if (currentUser) {
        await checkRole(currentUser.id);
      }
      clearTimeout(timeout)
      setLoading(false)
    }).catch((err) => {
      console.error("Error getting session:", err);
      clearTimeout(timeout)
      setLoading(false)
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(currentUser);
        if (currentUser) {
          await checkRole(currentUser.id);
        }
        setLoading(false);
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut }}>
      {loading && showRetry ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <div className="space-y-4 max-w-sm">
            <h2 className="text-xl font-semibold text-foreground">O carregamento está demorando mais que o esperado</h2>
            <p className="text-muted-foreground">Isso pode ser um problema de conexão. Deseja tentar carregar novamente?</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleRetry}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Tentar novamente
              </button>
              <button 
                onClick={() => setLoading(false)}
                className="w-full py-2 px-4 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
              >
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
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
