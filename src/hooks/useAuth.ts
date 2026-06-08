import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = ainda carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Auth session loaded:", session?.user?.id ? "authenticated" : "anonymous");
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event, session?.user?.id ? "authenticated" : "anonymous");
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading: user === undefined, signOut }
}
