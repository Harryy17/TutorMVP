import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import {
  Sparkles, ArrowRight, Search, BookOpen, Brain, GraduationCap,
  Shield, CheckCircle2, ChevronDown, Layers, FileText, ArrowUpRight,
  LogOut, User as UserIcon, Flame, Star, ShieldCheck, Mail, Compass,
  Cpu, Award, MessageSquareQuote, Check, ArrowDown
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
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
    badge: 'Research Track',
  },
]

// Educational Track Matrix Data
const ACADEMIC_TRACKS = [
  {
    id: 'undergrad',
    title: 'Undergraduate Foundations',
    subtitle: 'Rigorous conceptual fundamentals, problem-solving intuition, and exam preparation',
    target: 'First-to-Final Year Scholars',
    pacing: '10–12 Weeks per Discipline',
    features: [
      'Deconstructed core textbook syllabi (Calculus, Linear Algebra, Algorithms)',
      'Step-by-step visual proofs with intuitive real-world analogies',
      'Diagnostic quizzes with immediate step-level error pinpointing',
      'Active recall memory tracking for persistent concept mastery',
    ],
    sampleCourses: ['Multivariate Calculus', 'Data Structures & Algorithms', 'Classical Electrodynamics'],
  },
  {
    id: 'postgrad',
    title: 'Postgraduate & Doctoral Research',
    subtitle: 'Peer-reviewed treatises, mathematical derivations, and open-problem formulation',
    target: 'MSc, PhD Candidates & Researchers',
    pacing: 'Continuous Deep Dive & Socratic Defense',
    features: [
      'Dense research paper parsing (ArXiv, IEEE, ACM) with equation grounding',
      'Socratic thesis challenge: defends assumptions against theoretical edge cases',
      'Multi-modal table & diagram extraction via Gemini VLM',
      'Automated written proofs and derivation checks without hand-waving',
    ],
    sampleCourses: ['Stochastic Partial Differential Equations', 'Quantum Field Theory', 'Asymmetric Cryptography'],
  },
  {
    id: 'olympiad',
    title: 'Olympiad & Competitive Honors',
    subtitle: 'High-order non-standard problems, proof competitions, and technical interviews',
    target: 'Putnam, IMO, ICPC & Quant Fellows',
    pacing: 'High-Intensity Problem Sprints',
    features: [
      'Counter-example generation & adversarial problem decomposition',
      'Time-pressured mixed examination suite with strict rubric scoring',
      'Mastery metrics benchmarking your solution against optimal canonical proofs',
      'Zero cognitive hallucination: all claims cited directly to verified lemmas',
    ],
    sampleCourses: ['Advanced Combinatorics & Graph Theory', 'Measure Theory', 'High-Frequency Quantitative Systems'],
  },
]

// Live Interactive Syllabus Data
const LIVE_SYLLABI = [
  {
    subject: 'Quantum Information & Computation',
    code: 'PHYS 7401',
    modules: [
      { num: '01', title: 'Density Operators & Quantum Mixed States', desc: 'von Neumann entropy, partial trace, purification theorems' },
      { num: '02', title: 'Decoherence & Lindblad Master Equation', desc: 'Markovian open quantum systems, Kraus representations' },
      { num: '03', title: 'Surface Codes & Stabilizer Formalism', desc: 'Fault-tolerant quantum error correction, syndrome measurement' },
    ],
    samplePrompt: '"Derive the Lindblad generator for a 2-level atom coupled to a thermal bath."',
  },
  {
    subject: 'Neural Attention & Large Language Models',
    code: 'CS 8803',
    modules: [
      { num: '01', title: 'Multi-Head Attention Manifolds & Scaled Projections', desc: 'Matrix derivations of scaled dot-product attention and KV caching' },
      { num: '02', title: 'Loss Landscapes, AdamW & Normalization Layers', desc: 'Hessian spectrum analysis, RMSNorm, and residual stream dynamics' },
      { num: '03', title: 'Hardware-Aware Inference & FlashAttention Kernel Fusion', desc: 'SRAM memory hierarchy, tiling, and FP8 precision mechanics' },
    ],
    samplePrompt: '"Explain why FlashAttention achieves exact attention with O(N) SRAM complexity."',
  },
  {
    subject: 'Differential Forms & Stokes Theorem',
    code: 'MATH 6120',
    modules: [
      { num: '01', title: 'Differentiable Manifolds & Tangent Bundles', desc: 'Smooth atlases, transition maps, derivation of tangent vectors' },
      { num: '02', title: 'Exterior Algebra & Exterior Derivative', desc: 'Wedge product associativity, anti-symmetry, and d² = 0 identity' },
      { num: '03', title: 'Generalized Stokes Theorem & de Rham Cohomology', desc: 'Integration on oriented manifolds with boundary: ∫_∂M ω = ∫_M dω' },
    ],
    samplePrompt: '"Show that every closed 1-form on a simply connected manifold is exact."',
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

  // Track selection state
  const [activeTrack, setActiveTrack] = useState<string>('undergrad')
  const [activeSyllabusIdx, setActiveSyllabusIdx] = useState<number>(0)

  // Newsletter state
  const [emailSub, setEmailSub] = useState('')
  const [subSuccess, setSubSuccess] = useState(false)

  const handleLaunchStudio = (subjectOverride?: string) => {
    const subj = subjectOverride || selectedDomain
    navigate(`/study?subject=${encodeURIComponent(subj)}`)
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (emailSub.trim()) {
      setSubSuccess(true)
      setTimeout(() => setSubSuccess(false), 4000)
      setEmailSub('')
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-stone-900 antialiased selection:bg-stone-200">
      {/* ── 1. Top Luxury Navigation ── */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#FBFBF9]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
          {/* Brand Logo */}
          <Link
            to="/"
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
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-stone-600">
            <Link to="/curriculum" className="hover:text-stone-950 transition-colors">
              Curricula & Syllabi
            </Link>
            <Link to="/methodology" className="hover:text-stone-950 transition-colors">
              Pedagogical Engine
            </Link>
            <a href="#tracks" className="hover:text-stone-950 transition-colors">
              Academic Tracks
            </a>
            <a href="#architecture" className="hover:text-stone-950 transition-colors">
              Cognitive Architecture
            </a>
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
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-xs font-medium text-stone-700 hover:text-stone-950 transition cursor-pointer"
                >
                  Sign In
                </Link>
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
              <span>Bespoke 1-on-1 Academic Mentorship · Grounded in Rigorous Research</span>
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

      {/* ── 5. Educational Track Matrix ── */}
      <section id="tracks" className="border-t border-stone-200/80 bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Educational Tiers
              </span>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-stone-900 tracking-tight">
                Designed for Every Stage of Academic Ascent
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 max-w-md">
              Whether preparing for college examinations or defending a doctoral dissertation, Tutor MVP calibrates cognitive complexity dynamically.
            </p>
          </div>

          {/* Segmented Track Switcher */}
          <div className="mt-10 flex bg-[#FAF9F5] p-1.5 rounded-2xl border border-stone-200/90 max-w-2xl">
            {ACADEMIC_TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTrack(t.id)}
                className={`flex-1 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTrack === t.id
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {t.title.split(' ')[0]} Track
              </button>
            ))}
          </div>

          {/* Active Track Showcase Card */}
          {(() => {
            const track = ACADEMIC_TRACKS.find((t) => t.id === activeTrack) || ACADEMIC_TRACKS[0]
            return (
              <div className="mt-8 rounded-3xl border border-stone-200/90 bg-[#FAF9F5] p-8 sm:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                    <GraduationCap size={14} />
                    <span>{track.target} · {track.pacing}</span>
                  </div>

                  <h3 className="font-serif text-3xl font-normal text-stone-950">
                    {track.title}
                  </h3>

                  <p className="text-stone-600 text-sm leading-relaxed font-light">
                    {track.subtitle}
                  </p>

                  <div className="space-y-3 pt-2">
                    {track.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                          <Check size={12} />
                        </div>
                        <span className="text-xs text-stone-700 leading-normal">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      onClick={() => handleLaunchStudio(track.sampleCourses[0])}
                      className="rounded-full bg-stone-900 px-6 py-3 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition flex items-center gap-2"
                    >
                      <span>Start in {track.title.split(' ')[0]} Mode</span>
                      <ArrowRight size={13} />
                    </button>
                    <Link
                      to="/curriculum"
                      className="text-xs font-semibold text-stone-600 hover:text-stone-950 px-4 py-3"
                    >
                      Browse All {track.title.split(' ')[0]} Syllabi →
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-6 space-y-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Curriculum Highlights & Canonical Courses
                  </span>
                  <div className="space-y-2.5">
                    {track.sampleCourses.map((c, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleLaunchStudio(c)}
                        className="p-3.5 rounded-xl border border-stone-100 hover:border-stone-300 bg-[#FAF9F5] transition cursor-pointer flex items-center justify-between group"
                      >
                        <span className="text-xs font-semibold text-stone-800 group-hover:text-stone-950">{c}</span>
                        <ArrowUpRight size={13} className="text-stone-400 group-hover:text-stone-900 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ── 6. Interactive Live Syllabus Previewer ── */}
      <section className="py-20 border-t border-stone-200/80 bg-[#FAF9F5]">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Live Syllabus Engine Preview
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-stone-900">
              Inspect Real Dissected Learning Blueprints
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-stone-500">
              See how our multimodal parser extracts verified learning objectives from heavy academic texts.
            </p>
          </div>

          {/* Subject Pills */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {LIVE_SYLLABI.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSyllabusIdx(idx)}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                  activeSyllabusIdx === idx
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {s.subject}
              </button>
            ))}
          </div>

          {/* Active Syllabus Display Card */}
          {(() => {
            const syl = LIVE_SYLLABI[activeSyllabusIdx]
            return (
              <div className="mt-8 max-w-4xl mx-auto bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
                  <div>
                    <span className="text-[11px] font-mono text-amber-800 font-bold uppercase">{syl.code}</span>
                    <h3 className="mt-1 font-serif text-2xl font-normal text-stone-950">{syl.subject}</h3>
                  </div>
                  <button
                    onClick={() => handleLaunchStudio(syl.subject)}
                    className="shrink-0 flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-xs font-semibold text-white hover:bg-stone-800 transition"
                  >
                    <span>Launch This Course</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* Modules list */}
                <div className="mt-6 space-y-4">
                  {syl.modules.map((m, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FAF9F5] border border-stone-100">
                      <span className="font-mono text-sm font-bold text-stone-400 mt-0.5">{m.num}</span>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">{m.title}</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5 font-light">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sample Socratic Question */}
                <div className="mt-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-950">
                  <MessageSquareQuote size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[11px] uppercase tracking-wider text-amber-800">Sample Socratic Prompt:</span>
                    <p className="mt-0.5 italic">{syl.samplePrompt}</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ── 7. Curated Masterclass Modules Grid (Matching Ronas IT Listings) ── */}
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
            <Link
              to="/curriculum"
              className="text-xs font-semibold text-stone-900 hover:text-amber-800 flex items-center gap-1"
            >
              <span>Explore Full Curricula Catalog (50+ Courses)</span>
              <ArrowRight size={13} />
            </Link>
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

      {/* ── 8. Comprehensive Luxury Academic Footer ── */}
      <footer className="border-t border-stone-200 bg-[#FAF9F5] pt-16 pb-12">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          
          {/* Top Newsletter / Academic Gazette Dispatch */}
          <div className="rounded-3xl border border-stone-200 bg-white p-8 sm:p-12 shadow-xs mb-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                The Scholar’s Gazette
              </span>
              <h3 className="mt-1 font-serif text-2xl sm:text-3xl font-normal text-stone-950">
                Subscribe to Bi-Weekly Curricula Dispatches
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-stone-500 font-light leading-relaxed">
                Receive deconstructed mathematical monographs, syllabus breakdowns, and cognitive science research directly in your inbox.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="w-full md:w-auto flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  required
                  value={emailSub}
                  onChange={(e) => setEmailSub(e.target.value)}
                  placeholder="fellow@oxford.ac.uk"
                  className="w-full sm:w-72 rounded-2xl border border-stone-200 bg-[#FAF9F5] pl-10 pr-4 py-3 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-800"
                />
              </div>
              <button
                type="submit"
                className="rounded-2xl bg-stone-900 px-6 py-3 text-xs font-semibold text-white hover:bg-stone-800 transition shrink-0 cursor-pointer"
              >
                {subSuccess ? 'Subscribed!' : 'Join Gazette'}
              </button>
            </form>
          </div>

          {/* 5-Column Navigation Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-14 border-b border-stone-200/80">
            {/* Column 1: Academic Disciplines */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Disciplines
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600">
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Pure Mathematics</Link></li>
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Theoretical Physics</Link></li>
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Deep Learning & AI</Link></li>
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Distributed Consensus</Link></li>
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Quantitative Finance</Link></li>
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Biomedical Systems</Link></li>
              </ul>
            </div>

            {/* Column 2: Pedagogical Engine */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Pedagogy Engine
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600">
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Socratic Chat Mode</Link></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Progressive Teacher Mode</Link></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Mixed Examination Suite</Link></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">VLM Diagram OCR</Link></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Cognitive Memory Graph</Link></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Bloom’s Taxonomy Ladder</Link></li>
              </ul>
            </div>

            {/* Column 3: Scholar Resources */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Scholar Library
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600">
                <li><Link to="/curriculum" className="hover:text-stone-950 transition">Syllabus Repository</Link></li>
                <li><a href="#curriculum" className="hover:text-stone-950 transition">Formula Index</a></li>
                <li><a href="#tracks" className="hover:text-stone-950 transition">Problem Set Archives</a></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Academic Whitepapers</Link></li>
                <li><Link to="/login" className="hover:text-stone-950 transition">Guest Scholar Portal</Link></li>
              </ul>
            </div>

            {/* Column 4: Sovereignty & Safety */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Data Sovereignty
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600">
                <li><span className="text-stone-500">Multi-Tenant PGVector</span></li>
                <li><span className="text-stone-500">Zero Cross-User Leakage</span></li>
                <li><span className="text-stone-500">Encrypted Chunk Partitioning</span></li>
                <li><span className="text-stone-500">FERPA & GDPR Compliance</span></li>
                <li><span className="text-stone-500">Non-Training Model Isolation</span></li>
              </ul>
            </div>

            {/* Column 5: Institutional Access */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Institutional
              </h4>
              <ul className="space-y-2.5 text-xs text-stone-600">
                <li><a href="#tracks" className="hover:text-stone-950 transition">University Departments</a></li>
                <li><a href="#tracks" className="hover:text-stone-950 transition">Research Lab Licenses</a></li>
                <li><Link to="/methodology" className="hover:text-stone-950 transition">Faculty Advisory</Link></li>
                <li><Link to="/login" className="hover:text-stone-950 transition">Dean’s Office Portal</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar with Status Indicator */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <div className="flex items-center gap-3">
              <span className="font-serif font-bold tracking-wider text-stone-900">TUTOR MVP</span>
              <span>·</span>
              <span>Architectural Academic Intelligence</span>
            </div>

            {/* Live Health Indicator Pill */}
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1 text-[11px] text-stone-600 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All AI Systems Operational · PostgreSQL PGVector Active</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-stone-400">
              <span>© {new Date().getFullYear()} Tutor MVP</span>
              <span>·</span>
              <a href="#" className="hover:text-stone-700 transition">Academic Integrity</a>
              <span>·</span>
              <a href="#" className="hover:text-stone-700 transition">Privacy</a>
            </div>
          </div>

        </div>
      </footer>

      {/* ── 9. Auth Modal ── */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => handleLaunchStudio()}
      />
    </div>
  )
}
