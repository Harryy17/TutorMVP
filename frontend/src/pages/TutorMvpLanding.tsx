import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, ArrowRight, Search, BookOpen, Brain, GraduationCap,
  Shield, CheckCircle2, ChevronDown, Layers, FileText, ArrowUpRight,
  LogOut, User as UserIcon, Flame, Star
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import AuthModal from '../components/auth/AuthModal'

const DOMAIN_OPTIONS = [
  'Computer Science & AI',
  'Pure Mathematics',
  'Theoretical Physics',
  'Biomedical Systems',
  'Quantitative Finance',
  'Operating Systems',
]

const TIER_OPTIONS = [
  'Undergraduate Mastery',
  'Postgraduate Research',
  'Olympiad & Honors',
  'Exam Sprint & Revision',
]

const FORMAT_OPTIONS = [
  'Socratic Chat (Normal Mode)',
  'Step-by-Step Teacher Mode',
  'Comprehensive Exam Suite',
  'Interactive Study Map',
]

const FEATURED_MODULES = [
  {
    title: 'Advanced Deep Learning & Neural Systems',
    domain: 'Computer Science',
    tier: 'Postgraduate',
    summary: 'Transformer mechanics, multi-head attention, backpropagation derivations, and GPU memory optimization.',
    rating: '4.98',
    modulesCount: 14,
    bgGradient: 'from-amber-900/10 to-stone-900/20',
    image: 'https://images.unsplash.com/photo-1507842229451-7f01be7fe734?auto=format&fit=crop&w=800&q=80',
    badge: 'Flagship Program',
  },
  {
    title: 'Distributed Consensus & Fault-Tolerant Networks',
    domain: 'Systems Architecture',
    tier: 'Honors',
    summary: 'Raft, Paxos, distributed transaction isolation, and high-throughput vector indexing pipelines.',
    rating: '4.95',
    modulesCount: 10,
    bgGradient: 'from-stone-800/10 to-stone-950/20',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    badge: 'High Demand',
  },
  {
    title: 'Differential Topology & Manifold Analysis',
    domain: 'Pure Mathematics',
    tier: 'Olympiad',
    summary: 'Smooth manifolds, tangent bundles, exterior calculus, and Stokes theorem on differential forms.',
    rating: '5.0',
    modulesCount: 16,
    bgGradient: 'from-amber-800/10 to-stone-900/20',
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
    badge: 'Research Track',
  },
]

export default function TutorMvpLanding() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState(DOMAIN_OPTIONS[0])
  const [selectedTier, setSelectedTier] = useState(TIER_OPTIONS[0])
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_OPTIONS[0])

  const handleLaunchStudio = (subjectOverride?: string) => {
    const subj = subjectOverride || selectedDomain
    navigate(`/study?subject=${encodeURIComponent(subj)}`)
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-stone-900 antialiased selection:bg-stone-200">
      {/* ── 1. Top Luxury Navigation ── */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#FBFBF9]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
          {/* Brand Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-stone-100 shadow-sm transition-transform group-hover:scale-105">
              <span className="font-serif font-bold text-sm tracking-widest text-amber-300">TM</span>
            </div>
            <div>
              <span className="font-serif text-lg font-bold tracking-tight text-stone-900">
                TUTOR <span className="font-sans font-light text-stone-500 text-sm">MVP</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-stone-600">
            <a href="#curriculum" className="hover:text-stone-950 transition-colors">Programs</a>
            <a href="#methodology" className="hover:text-stone-950 transition-colors">Methodology</a>
            <a href="#intelligence" className="hover:text-stone-950 transition-colors">AI Architecture</a>
            <a href="#results" className="hover:text-stone-950 transition-colors">Scholar Outcomes</a>
          </nav>

          {/* User Session Action */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-stone-800">{user.username}</span>
                  <span className="text-[10px] text-stone-400 font-mono">Isolated Session</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchStudio()}
                  className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 active:scale-95 transition cursor-pointer"
                >
                  <span>Enter Studio</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="rounded-full border border-stone-200 bg-white p-2 text-stone-400 hover:text-stone-800 hover:border-stone-300 transition cursor-pointer"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="rounded-full px-4 py-2 text-xs font-medium text-stone-700 hover:text-stone-950 transition cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 active:scale-95 transition cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          {/* Eyebrow Tag */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white px-4 py-1.5 text-xs font-medium text-stone-600 shadow-2xs">
              <Sparkles size={12} className="text-amber-600" />
              <span>Bespoke 1-on-1 Academic Mentorship · Powered by gpt-6-sol</span>
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-center max-w-4xl mx-auto"
          >
            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-stone-950 leading-[1.08]">
              Discover Architectural Mastery & Bespoke Academic Guidance
            </h1>
            <p className="mt-6 text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl mx-auto font-light">
              An elite educational sanctuary designed for exceptional scholars. Upload course materials,
              synthesize grounded syllabus roadmaps, and solve rigorous academic problems without hallucination.
            </p>
          </motion.div>

          {/* ── 3. Floating Luxury Filter Search Bar (Ronas IT Real Estate Widget Style) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 mx-auto max-w-4xl rounded-3xl border border-stone-200/90 bg-white p-3 sm:p-4 shadow-[0_12px_45px_rgba(0,0,0,0.04)]"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-stone-100">
              {/* Field 1: Domain / Discipline */}
              <div className="px-4 py-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Academic Discipline
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="w-full bg-transparent font-medium text-sm text-stone-800 focus:outline-hidden cursor-pointer"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 2: Academic Tier */}
              <div className="px-4 py-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Mentorship Tier
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="w-full bg-transparent font-medium text-sm text-stone-800 focus:outline-hidden cursor-pointer"
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 3: Studio Mode + CTA Button */}
              <div className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Studio Mode
                  </span>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="mt-1 w-full bg-transparent font-medium text-sm text-stone-800 focus:outline-hidden cursor-pointer"
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchStudio()}
                  className="shrink-0 flex items-center gap-2 rounded-2xl bg-stone-900 px-6 py-3.5 text-xs font-semibold text-white shadow-md hover:bg-stone-800 active:scale-95 transition cursor-pointer"
                >
                  <span>Enter Studio</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── 4. Asymmetric Hero Imagery & Floating Metric Cards ── */}
          <div className="relative mt-14 mx-auto max-w-5xl">
            {/* Main Center Architectural Image Showcase */}
            <div className="relative h-[340px] sm:h-[480px] w-full overflow-hidden rounded-3xl border border-stone-200/90 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1600&q=85"
                alt="Tutor MVP Luxury Study Sanctuary"
                className="h-full w-full object-cover brightness-[0.97] transition-transform duration-700 hover:scale-102"
              />
              <div className="absolute inset-0 bg-linear-to-t from-stone-950/70 via-stone-950/20 to-transparent" />

              {/* Bottom Caption on Image */}
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
                <div>
                  <span className="inline-block rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[11px] font-medium tracking-wide">
                    Private Studio Sanctuary
                  </span>
                  <h3 className="mt-2 font-serif text-xl sm:text-2xl font-light">
                    The Library of High-Precision Academic Synthesis
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchStudio()}
                  className="hidden sm:flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-stone-900 shadow-sm hover:bg-white transition"
                >
                  <span>Launch Session</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            {/* Floating Metric Card 1 (Top Left) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-6 -left-4 hidden md:block w-64 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-xl backdrop-blur-md select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">Zero Hallucination</p>
                  <p className="text-[11px] text-stone-500">Grounded in uploaded PDFs</p>
                </div>
              </div>
            </motion.div>

            {/* Floating Metric Card 2 (Bottom Right) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="absolute -bottom-6 -right-4 hidden md:block w-72 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-xl backdrop-blur-md select-none"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-serif text-2xl font-semibold text-stone-900">99.4%</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Top-Percentile Exam Mastery</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={18} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 5. Curated Masterclass Modules Grid (Matching Ronas IT Listings) ── */}
      <section id="curriculum" className="border-t border-stone-200/80 bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Curated Academic Suites
              </span>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-stone-900 tracking-tight">
                Architectural Syllabus Blueprints
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md">
              Each syllabus module is parsed into verified atomic concepts with dedicated pedagogical teaching streams and interactive problem sets.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURED_MODULES.map((item, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleLaunchStudio(item.title)}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-[#FAF9F5] shadow-xs hover:shadow-xl transition-all cursor-pointer"
              >
                {/* Image Header */}
                <div className="relative h-56 w-full overflow-hidden bg-stone-100">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-stone-800 shadow-2xs">
                      {item.badge}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="flex items-center gap-1 rounded-full bg-stone-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-amber-300 shadow-2xs">
                      <Star size={11} fill="currentColor" />
                      <span>{item.rating}</span>
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      <span>{item.domain}</span>
                      <span>·</span>
                      <span>{item.tier}</span>
                    </div>

                    <h3 className="mt-2 font-serif text-xl font-normal text-stone-900 group-hover:text-amber-800 transition-colors">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-stone-200/70 pt-4 text-xs font-semibold text-stone-900">
                    <span className="text-stone-500 font-normal">{item.modulesCount} Core Modules</span>
                    <span className="flex items-center gap-1 text-stone-900 group-hover:translate-x-1 transition-transform">
                      <span>Open Syllabus</span>
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Bottom Banner & Footer ── */}
      <footer className="border-t border-stone-200 bg-[#FAF9F5] py-12 text-center text-xs text-stone-500">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-stone-900">
            <span>TUTOR MVP</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            Architectural Academic Intelligence · Grounded Azure gpt-6-sol & Supabase PGVector
          </p>
          <p className="mt-4 text-[10px] text-stone-400">
            © 2026 Tutor MVP. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ── 7. Auth Modal ── */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => handleLaunchStudio()}
      />
    </div>
  )
}

