import React from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles, ArrowRight, Brain, Layers, ShieldCheck, CheckCircle2,
  FileCheck, Cpu, Database, Eye, BookOpen, Compass, Award, MessageSquareQuote
} from 'lucide-react'

export default function MethodologyPage() {
  const navigate = useNavigate()

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
            <Link to="/curriculum" className="hover:text-stone-950 transition-colors">
              Academic Curricula
            </Link>
            <Link to="/methodology" className="text-stone-950 font-semibold border-b border-stone-900 pb-0.5">
              Pedagogical Engine
            </Link>
            <Link to="/login" className="hover:text-stone-950 transition-colors">
              Authentication
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/study')}
              className="flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition"
            >
              <span>Launch Studio</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-stone-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-semibold uppercase tracking-wider text-stone-700">
            <Brain size={14} className="text-amber-700" />
            <span>Cognitive Science & AI Pedagogy</span>
          </div>

          <h1 className="mt-6 font-serif text-4xl sm:text-6xl font-normal text-stone-950 tracking-tight leading-tight">
            The Science of Uncompromising <br />
            <span className="italic font-light">Academic Synthesis</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-stone-600 leading-relaxed font-light max-w-2xl mx-auto">
            Tutor MVP is built on cognitive psychology, Bloom’s revised taxonomy, and zero-hallucination
            dense-vector retrieval. We replace passive memorization with active inquiry and verifiable derivations.
          </p>
        </div>
      </section>

      {/* Pillar 1: The 4-Phase Learning Pipeline */}
      <section className="py-20 border-b border-stone-200/80">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              The Cognitive Architecture
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-stone-900">
              Four Stages of Mathematical Grounding
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Stage 1 */}
            <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xs flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">PHASE 01</span>
                <h3 className="mt-3 font-serif text-xl font-normal text-stone-950">Multi-Modal Ingestion & OCR</h3>
                <p className="mt-3 text-xs text-stone-600 leading-relaxed font-light">
                  Scanned PDF pages, complex mathematical formulas, and scientific diagrams are transcribed via Vision-Language Models (VLM) with precise page coordinates.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-100 text-[11px] text-stone-400 font-mono">
                Sub-second Fast Path
              </div>
            </div>

            {/* Stage 2 */}
            <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xs flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">PHASE 02</span>
                <h3 className="mt-3 font-serif text-xl font-normal text-stone-950">Syllabus Graph Synthesis</h3>
                <p className="mt-3 text-xs text-stone-600 leading-relaxed font-light">
                  Unstructured lecture notes and textbooks are parsed into an ordered sequence of foundational and dependent modules, establishing clear prerequisites.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-100 text-[11px] text-stone-400 font-mono">
                Topological Dependency Sort
              </div>
            </div>

            {/* Stage 3 */}
            <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xs flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">PHASE 03</span>
                <h3 className="mt-3 font-serif text-xl font-normal text-stone-950">Socratic Teacher Stream</h3>
                <p className="mt-3 text-xs text-stone-600 leading-relaxed font-light">
                  Step-by-step progressive lesson delivery (Intuition → Formal Equation → Rigorous Proof → Counter-Example) paired with real-time doubt resolution.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-100 text-[11px] text-stone-400 font-mono">
                Progressive SSE Streaming
              </div>
            </div>

            {/* Stage 4 */}
            <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xs flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">PHASE 04</span>
                <h3 className="mt-3 font-serif text-xl font-normal text-stone-950">Adaptive Examination Suite</h3>
                <p className="mt-3 text-xs text-stone-600 leading-relaxed font-light">
                  Mixed written proofs, multi-concept MCQs, and fill-in-the-blanks evaluated against strict pedagogical rubrics to quantify genuine conceptual mastery.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-100 text-[11px] text-stone-400 font-mono">
                Mastery-Grade Evaluation
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 2: Bloom's Taxonomy Alignment */}
      <section className="py-20 bg-white border-b border-stone-200/80">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Bloom’s Revised Hierarchy
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-stone-900">
              Progression from Knowledge to Synthesis
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-stone-500">
              Unlike generic conversational models that jump to shallow summaries, Tutor MVP ascends cognitive depth tiers deliberately.
            </p>
          </div>

          <div className="mt-12 space-y-3 max-w-3xl mx-auto">
            {[
              { level: 'Tier 6: Synthesis & Creation', desc: 'Formulating novel hypotheses, designing fault-tolerant systems, and connecting cross-disciplinary proofs.', bg: 'bg-stone-900 text-white' },
              { level: 'Tier 5: Critical Evaluation', desc: 'Debating algorithm trade-offs, proving complexity lower bounds, and identifying edge cases in theorems.', bg: 'bg-stone-800 text-white' },
              { level: 'Tier 4: Structural Analysis', desc: 'Decomposing complex distributed protocols or multi-variable differential equations into atomic sub-problems.', bg: 'bg-stone-200 text-stone-900' },
              { level: 'Tier 3: Problem Application', desc: 'Solving concrete numerical and theoretical problem sets using grounded course equations.', bg: 'bg-stone-100 text-stone-800' },
              { level: 'Tier 2: Conceptual Understanding', desc: 'Translating formal mathematics into intuitive physical and architectural analogies.', bg: 'bg-stone-50 text-stone-700' },
              { level: 'Tier 1: Foundational Recall', desc: 'Instantaneous retrieval of verified definitions, axioms, and exact citations from uploaded materials.', bg: 'bg-stone-50 text-stone-600' },
            ].map((tier, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl flex items-center justify-between border border-stone-200/60 ${tier.bg}`}
              >
                <div className="font-serif font-medium text-sm sm:text-base">{tier.level}</div>
                <div className="text-xs max-w-md text-right opacity-90 font-light">{tier.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillar 3: Multi-Tenant Privacy Guarantee */}
      <section className="py-20 bg-[#FAF9F5]">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 sm:p-12 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck size={32} />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Data Sovereignty Pledge
              </span>
              <h3 className="mt-1 font-serif text-2xl sm:text-3xl font-normal text-stone-950">
                100% Cryptographic User Isolation
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
                Every study session, chunk vector, cognitive weakness log, and dialogue turn is partitioned by your unique tenant identity.
                User A’s documents are completely invisible and un-searchable to User B.
              </p>
            </div>
            <Link
              to="/login"
              className="shrink-0 rounded-2xl bg-stone-900 px-6 py-3.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
            >
              Sign In to Private Studio
            </Link>
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

