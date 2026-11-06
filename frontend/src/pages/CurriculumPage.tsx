import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles, ArrowRight, BookOpen, GraduationCap, Search,
  Star, Clock, CheckCircle2, Layers, Filter, Compass,
  ChevronRight, Brain, FileText, ArrowUpRight
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

interface SyllabusModule {
  id: string
  code: string
  title: string
  faculty: string
  level: 'Undergraduate' | 'Postgraduate' | 'Olympiad / Research'
  duration: string
  rating: string
  prerequisites: string[]
  description: string
  topics: { title: string; hours: string; keyConcept: string }[]
  recommendedTexts: string[]
  image: string
}

const DISCIPLINES: SyllabusModule[] = [
  {
    id: 'cs-deep-learning',
    code: 'CS 8803',
    title: 'Advanced Deep Learning & Neural Systems',
    faculty: 'School of Computational Intelligence',
    level: 'Postgraduate',
    duration: '14 Weeks · 42 Lectures',
    rating: '4.98',
    prerequisites: ['Multivariate Calculus', 'Linear Algebra', 'Algorithms & Data Structures'],
    description: 'A mathematically rigorous exploration of deep neural network architectures, attention manifolds, non-convex optimization landscapes, and generative diffusion models.',
    topics: [
      { title: 'Foundations of Backpropagation & Tensor Graphs', hours: '6 hrs', keyConcept: 'Reverse-mode automatic differentiation on computational DAGs' },
      { title: 'Transformer Architectures & Attention Manifolds', hours: '8 hrs', keyConcept: 'Scaled dot-product attention, multi-head projections, and KV caching' },
      { title: 'Optimization Dynamics & Loss Landscapes', hours: '6 hrs', keyConcept: 'AdamW, learning rate warmups, and Hessian spectrum analysis' },
      { title: 'Diffusion Models & Score-Based Generative SDEs', hours: '8 hrs', keyConcept: 'Fokker-Planck equations, reverse diffusion, and classifier-free guidance' },
      { title: 'Hardware-Aware Inference & Kernel Fusion', hours: '6 hrs', keyConcept: 'FlashAttention-3, FP8 quantization, and SRAM memory hierarchy' },
    ],
    recommendedTexts: [
      'Deep Learning — Goodfellow, Bengio, Courville',
      'Neural Network Methods in Natural Language Processing — Goldberg',
    ],
    image: 'https://images.unsplash.com/photo-1507842229451-7f01be7fe734?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'math-diff-geom',
    code: 'MATH 7120',
    title: 'Differential Topology & Smooth Manifolds',
    faculty: 'Department of Pure Mathematics',
    level: 'Olympiad / Research',
    duration: '16 Weeks · 48 Lectures',
    rating: '5.00',
    prerequisites: ['Real Analysis II', 'Point-Set Topology', 'Abstract Algebra'],
    description: 'Investigation of differentiable manifolds, tangent and cotangent bundles, differential forms, de Rham cohomology, and generalized Stokes theorem in arbitrary dimensions.',
    topics: [
      { title: 'Smooth Manifolds & Submanifolds', hours: '8 hrs', keyConcept: 'Charts, atlases, smooth maps, and Whitney embedding theorem' },
      { title: 'Tangent Vectors, Vector Fields & Lie Brackets', hours: '8 hrs', keyConcept: 'Derivations on germs of smooth functions and Frobenius integrability' },
      { title: 'Differential Forms & Exterior Calculus', hours: '8 hrs', keyConcept: 'Wedge products, interior multiplication, and Cartan calculus' },
      { title: 'Integration on Manifolds & Stokes Theorem', hours: '8 hrs', keyConcept: 'Orientability, partitions of unity, and boundary operators' },
      { title: 'de Rham Cohomology & Poincare Lemma', hours: '8 hrs', keyConcept: 'Exact forms, closed forms, and topological invariants' },
    ],
    recommendedTexts: [
      'Introduction to Smooth Manifolds — John M. Lee',
      'Differential Forms in Algebraic Topology — Bott & Tu',
    ],
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'phys-quantum-info',
    code: 'PHYS 6410',
    title: 'Quantum Information & Open Quantum Systems',
    faculty: 'Centre for Theoretical Physics',
    level: 'Postgraduate',
    duration: '12 Weeks · 36 Lectures',
    rating: '4.95',
    prerequisites: ['Quantum Mechanics I & II', 'Complex Variables', 'Hilbert Spaces'],
    description: 'Quantum density operators, decoherence mechanisms, Lindblad master equation, entanglement measures, and fault-tolerant quantum error correction codes.',
    topics: [
      { title: 'Density Operators & Reduced States', hours: '6 hrs', keyConcept: 'Partial trace, Schmidt decomposition, and purification' },
      { title: 'Quantum Decoherence & Open Dynamics', hours: '8 hrs', keyConcept: 'Kraus representation theorem and Lindblad master equation' },
      { title: 'Entanglement Quantification & Bell Inequalities', hours: '6 hrs', keyConcept: 'Concurrence, entanglement entropy, and CHSH violations' },
      { title: 'Stabilizer Formalism & Surface Codes', hours: '8 hrs', keyConcept: 'Pauli group, syndromes, and topological fault tolerance' },
    ],
    recommendedTexts: [
      'Quantum Computation and Quantum Information — Nielsen & Chuang',
      'The Theory of Open Quantum Systems — Breuer & Petruccione',
    ],
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'cs-distributed-systems',
    code: 'CS 7210',
    title: 'Distributed Consensus & Fault-Tolerant Engines',
    faculty: 'School of Computer Science',
    level: 'Postgraduate',
    duration: '14 Weeks · 42 Lectures',
    rating: '4.96',
    prerequisites: ['Operating Systems', 'Computer Networks', 'Concurrent Programming'],
    description: 'Theory and implementation of distributed state machine replication, leader election, Byzantine fault tolerance, vector clocks, and linearizable storage engines.',
    topics: [
      { title: 'Logical Clocks, Vector Clocks & Causality', hours: '6 hrs', keyConcept: 'Lamport timestamps and causal order anomalies' },
      { title: 'Paxos, Multi-Paxos & Raft Consensus', hours: '10 hrs', keyConcept: 'Leader election, log replication, and safety invariants' },
      { title: 'Byzantine Fault Tolerance & Practical BFT', hours: '8 hrs', keyConcept: 'Pre-prepare, prepare, commit phases under malicious adversaries' },
      { title: 'Distributed Transactions & 2-Phase Locking', hours: '8 hrs', keyConcept: '2PC, 3PC, Spanner true-time API, and Percolator model' },
    ],
    recommendedTexts: [
      'Designing Data-Intensive Applications — Martin Kleppmann',
      'Distributed Systems: Principles and Paradigms — Tanenbaum',
    ],
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'econ-quant-finance',
    code: 'FE 8300',
    title: 'Stochastic Calculus & Quantitative Asset Pricing',
    faculty: 'Institute for Financial Mathematics',
    level: 'Postgraduate',
    duration: '12 Weeks · 36 Lectures',
    rating: '4.92',
    prerequisites: ['Probability Theory & Measure', 'Ordinary Differential Equations'],
    description: 'Brownian motion, Ito’s lemma, Girsanov change of measure, Black-Scholes PDE, term structure modeling, and local volatility surfaces.',
    topics: [
      { title: 'Brownian Motion & Martingale Theory', hours: '6 hrs', keyConcept: 'Filtrations, stopping times, and quadratic variation' },
      { title: 'Ito Integration & Ito’s Multi-Dimensional Lemma', hours: '8 hrs', keyConcept: 'Stochastic differentials and chain rule for diffusion processes' },
      { title: 'Girsanov Theorem & Risk-Neutral Measures', hours: '8 hrs', keyConcept: 'Radon-Nikodym derivative and martingale representations' },
      { title: 'PDE Methods & Feynman-Kac Formula', hours: '8 hrs', keyConcept: 'Connecting parabolic PDEs with conditional stochastic expectations' },
    ],
    recommendedTexts: [
      'Stochastic Calculus for Finance II — Steven Shreve',
      'Arbitrage Theory in Continuous Time — Tomas Björk',
    ],
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'bio-comp-neuro',
    code: 'NEUR 7500',
    title: 'Computational Neuroscience & Biophysical Models',
    faculty: 'Centre for Brain & Cognitive Sciences',
    level: 'Undergraduate',
    duration: '12 Weeks · 36 Lectures',
    rating: '4.94',
    prerequisites: ['Cellular Biology', 'Differential Equations', 'Python/Numerical Computing'],
    description: 'Biophysical mechanisms of neuronal excitability, Hodgkin-Huxley equations, cable theory, synaptic plasticity rules, and attractor neural networks.',
    topics: [
      { title: 'Membrane Potential & Nernst-Goldman Equations', hours: '6 hrs', keyConcept: 'Ion channel kinetics and electrochemical equilibria' },
      { title: 'Hodgkin-Huxley Action Potential Equations', hours: '8 hrs', keyConcept: 'Nonlinear limit cycles and voltage-clamp conductance dynamics' },
      { title: 'Synaptic Transmission & Spike-Timing Dependent Plasticity', hours: '8 hrs', keyConcept: 'Hebbian learning, STDP, and long-term potentiation' },
      { title: 'Recurrent Neural Populations & Wilson-Cowan Models', hours: '8 hrs', keyConcept: 'Excitatory-inhibitory phase portraits and oscillatory rhythms' },
    ],
    recommendedTexts: [
      'Theoretical Neuroscience — Dayan & Abbott',
      'Biophysics of Computation — Christof Koch',
    ],
    image: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=800&q=80',
  },
]

export default function CurriculumPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [selectedLevel, setSelectedLevel] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeModule, setActiveModule] = useState<SyllabusModule>(DISCIPLINES[0])

  const filtered = DISCIPLINES.filter((d) => {
    const matchesLevel = selectedLevel === 'All' || d.level.includes(selectedLevel)
    const matchesQuery =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesLevel && matchesQuery
  })

  const handleLaunch = (subject: string) => {
    navigate(`/study?subject=${encodeURIComponent(subject)}`)
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-stone-900 font-sans selection:bg-stone-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F5]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-stone-100 shadow-sm transition-transform group-hover:scale-105">
              <span className="font-serif font-bold text-sm tracking-widest text-amber-300">TM</span>
            </div>
            <div>
              <span className="font-serif text-lg font-bold tracking-tight text-stone-900">
                TUTOR <span className="font-sans font-light text-stone-500 text-sm">MVP</span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-stone-600">
            <Link to="/curriculum" className="text-stone-950 font-semibold border-b border-stone-900 pb-0.5">
              Academic Curricula
            </Link>
            <Link to="/methodology" className="hover:text-stone-950 transition-colors">
              Pedagogical Engine
            </Link>
            <Link to="/login" className="hover:text-stone-950 transition-colors">
              Authentication
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLaunch(activeModule.title)}
              className="flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition"
            >
              <span>Launch Studio</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-stone-200/80 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-semibold uppercase tracking-wider text-stone-700">
              <BookOpen size={13} className="text-amber-700" />
              <span>Syllabus Blueprint Catalog</span>
            </div>
            <h1 className="mt-4 font-serif text-4xl sm:text-5xl font-normal text-stone-950 tracking-tight leading-tight">
              Rigorous Academic Curricula & Masterclass Syllabi
            </h1>
            <p className="mt-4 text-stone-600 text-base leading-relaxed font-light">
              Explore meticulously decomposed university-level curricula. Every course is indexed into verifiable
              learning objectives, mathematical derivations, Socratic dialogue paths, and adaptive examination suites.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-100 pt-8">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              {['All', 'Undergraduate', 'Postgraduate', 'Olympiad'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    selectedLevel === lvl
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subjects, codes, or keywords..."
                className="w-full rounded-full border border-stone-200 bg-[#FAF9F5] pl-10 pr-4 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Split-Pane Explorer */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: List of Disciplines */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
                Showing {filtered.length} Structured Disciplines
              </span>

              <div className="space-y-3">
                {filtered.map((item) => {
                  const isSelected = activeModule.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveModule(item)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 bg-white shadow-md'
                          : 'border-stone-200/90 bg-[#FAF9F5] hover:bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                        <span>{item.code}</span>
                        <span className="flex items-center gap-1 text-amber-700 font-bold">
                          <Star size={11} fill="currentColor" />
                          <span>{item.rating}</span>
                        </span>
                      </div>
                      <h3 className="mt-1 font-serif text-lg font-medium text-stone-900">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-stone-500 pt-3 border-t border-stone-100">
                        <span>{item.level}</span>
                        <span>{item.duration}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Column: Detailed Syllabus Inspector */}
            <div className="lg:col-span-7 sticky top-24">
              <div className="rounded-3xl border border-stone-200/90 bg-white p-8 shadow-sm">
                
                {/* Header info */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      {activeModule.faculty} · {activeModule.code}
                    </span>
                    <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-normal text-stone-950">
                      {activeModule.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleLaunch(activeModule.title)}
                    className="shrink-0 flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 transition"
                  >
                    <span>Study in Room</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <p className="mt-4 text-sm text-stone-600 leading-relaxed font-light">
                  {activeModule.description}
                </p>

                {/* Prerequisites Badge Row */}
                <div className="mt-6 p-4 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Recommended Prerequisites
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeModule.prerequisites.map((p, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-white border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Module Syllabus Breakdown */}
                <div className="mt-8">
                  <h3 className="font-serif text-lg font-normal text-stone-900 flex items-center gap-2">
                    <Layers size={17} className="text-stone-700" />
                    <span>Curricular Module Breakdown</span>
                  </h3>

                  <div className="mt-4 space-y-3">
                    {activeModule.topics.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-stone-100 bg-[#FAF9F5] flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-stone-800 text-xs font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-stone-900">{t.title}</h4>
                            <p className="text-[11px] text-stone-500 mt-0.5">{t.keyConcept}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-stone-400 shrink-0">{t.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Texts */}
                <div className="mt-8 pt-6 border-t border-stone-100">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Canonical Textbooks & Treatises
                  </h4>
                  <ul className="mt-2 space-y-1.5">
                    {activeModule.recommendedTexts.map((text, idx) => (
                      <li key={idx} className="text-xs text-stone-600 flex items-center gap-2">
                        <FileText size={13} className="text-stone-400 shrink-0" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-[#FAF9F5] py-12 text-center text-xs text-stone-500">
        <p>© 2026 Tutor MVP — Architectural Academic Intelligence</p>
      </footer>
    </div>
  )
}

