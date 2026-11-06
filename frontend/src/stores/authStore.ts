import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
        // Wipe stored chat/study state so the next user has a pristine workspace
        try { localStorage.removeItem('deep-tutor-chat') } catch {}
        try { localStorage.removeItem('tutormvp_study_state') } catch {}
        set({ user: null, token: null, isAuthenticated: false })
      },
      updateUser: (user) => set({ user }),
    }),
    { name: 'deep-tutor-auth' }
  )
)
