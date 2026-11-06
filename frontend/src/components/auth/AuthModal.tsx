import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuthStore } from '../../stores/authStore'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  onSuccess?: () => void
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              username: fullName.trim() || email.split('@')[0],
            },
          },
        })

        if (error) throw error

        if (data.user) {
          const u = {
            id: data.user.id,
            username: fullName.trim() || data.user.email?.split('@')[0] || 'Scholar',
            email: data.user.email || email,
            role: 'student',
          }
          login(u, data.session?.access_token || 'supabase_token')
          setSuccessMsg('Account created! Welcome to Tutor MVP.')
          setTimeout(() => {
            onClose()
            onSuccess?.()
          }, 800)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })

        if (error) throw error

        if (data.user) {
          const u = {
            id: data.user.id,
            username:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.username ||
              data.user.email?.split('@')[0] ||
              'Scholar',
            email: data.user.email || email,
            role: 'student',
          }
          login(u, data.session?.access_token || 'supabase_token')
          setSuccessMsg('Welcome back to Tutor MVP!')
          setTimeout(() => {
            onClose()
            onSuccess?.()
          }, 600)
        }
      }
    } catch (err: any) {
      console.warn('[AuthModal] Auth notice:', err)
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo Guest Login for testing without email verification
  const handleGuestLogin = () => {
    const guestId = `scholar_${Math.random().toString(36).substring(2, 9)}`
    const guestUser = {
      id: guestId,
      username: 'Guest Scholar',
      email: 'guest@tutormvp.ai',
      role: 'student',
    }
    login(guestUser, `demo_token_${guestId}`)
    onClose()
    onSuccess?.()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with luxury soft blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/80 bg-[#FAF9F5] p-8 shadow-2xl"
          >
            {/* Top Close Button */}
            <button
              onClick={onClose}
              className="absolute right-5 top-5 rounded-full p-2 text-stone-400 hover:bg-stone-200/50 hover:text-stone-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header Badge & Title */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-wider text-stone-600 uppercase shadow-2xs">
                <Sparkles size={11} className="text-amber-600" />
                Tutor MVP · Private Studio
              </span>

              <h3 className="mt-3 font-serif text-2xl font-normal tracking-tight text-stone-900">
                {mode === 'signin' ? 'Access Your Study Suite' : 'Begin Your Mentorship'}
              </h3>
              <p className="mt-1.5 text-xs text-stone-500">
                {mode === 'signin'
                  ? 'Sign in to access your grounded course roadmaps and study notes.'
                  : 'Create an isolated scholar account with customized AI memory.'}
              </p>
            </div>

            {/* Mode Switcher Pills */}
            <div className="mt-6 flex rounded-xl border border-stone-200 bg-stone-200/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 rounded-lg py-2 font-medium transition-all ${
                  mode === 'signin'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-lg py-2 font-medium transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Alerts */}
            {errorMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1">
                    Full Name / Scholar ID
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-3 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sreehari"
                      className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-stone-800 focus:outline-hidden transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-3 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="scholar@domain.com"
                    className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-stone-800 focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3 text-stone-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-stone-800 focus:outline-hidden transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-xs font-semibold text-white shadow-md hover:bg-stone-800 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'signin' ? 'Sign In to Study Suite' : 'Create Isolated Account'}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Guest Quick Login Divider */}
            <div className="mt-5 border-t border-stone-200 pt-4 text-center">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 transition cursor-pointer"
              >
                <span>Quick Tour as Guest Scholar</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

