import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../services/supabase'

interface User {
  id: string
  username: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      logout: () => {
        // Sign out of Supabase session
        try {
          supabase.auth.signOut().catch(() => {})
        } catch {}
        // Wipe stored chat/study state and auth cache so the next user has a pristine workspace
        try { localStorage.removeItem('deep-tutor-chat') } catch {}
        try { localStorage.removeItem('tutormvp_study_state') } catch {}
        try { localStorage.removeItem('deep-tutor-auth') } catch {}
        set({ user: null, token: null, isAuthenticated: false })
      },
      updateUser: (user) => set({ user }),
    }),
    { name: 'deep-tutor-auth' }
  )
)
