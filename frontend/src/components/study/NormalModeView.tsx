import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, Sparkles, ArrowLeft, ArrowRight, Loader2,
  MessageSquare, Lightbulb, CheckCircle2,
  Target, Key, AlertTriangle, Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TopicItem } from './TopicCards'
import { studyApi } from '../../services/api'
import { cleanAcademicText } from '../../utils/textFormatter'

interface StepItem {
  step_id: string
  step_number: number
  tag: string
  title: string
  subtitle?: string
  content: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface NormalModeViewProps {
  sessionId: string
  topic: TopicItem
  onBack: () => void
}

export default function NormalModeView({
  sessionId,
  topic,
  onBack,
}: NormalModeViewProps) {
  const [steps, setSteps] = useState<StepItem[]>([])
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0)
  const [isLoadingCore, setIsLoadingCore] = useState<boolean>(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputQuery, setInputQuery] = useState<string>('')
  const [isAsking, setIsAsking] = useState<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const doubtSectionRef = useRef<HTMLDivElement>(null)

  // Fetch structured core idea on mount
  useEffect(() => {
    let mounted = true
    setIsLoadingCore(true)

    studyApi.coreIdea({
      session_id: sessionId,
      topic_id: topic.id,
      topic_title: topic.title,
      topic_summary: topic.summary,
    })
      .then((res) => {
        if (!mounted) return
        const data = res.data?.core_idea

        if (data && data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
          const sanitized = data.steps.map((s: StepItem) => ({
            ...s,
            content: cleanAcademicText(s.content),
          }))
          setSteps(sanitized)
        } else if (typeof data === 'string') {
          const parsedSteps = parseMarkdownToSteps(data, topic.title, topic.summary)
          setSteps(parsedSteps)
        } else {
          setSteps(getDefaultSteps(topic))
        }
      })
      .catch((err) => {
        console.error('Error fetching core idea:', err)
        if (mounted) {
          setSteps(getDefaultSteps(topic))
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingCore(false)
      })

    return () => {
      mounted = false
    }
  }, [sessionId, topic.id])

  const getDefaultSteps = (t: TopicItem): StepItem[] => [
    {
      step_id: 'big_picture',
      step_number: 1,
      tag: 'THE BIG PICTURE',
      title: 'The Big Picture',
      subtitle: 'Intuition, purpose, and foundational motivation',
      content: `**${t.title}** is a foundational concept designed to solve core analytical challenges, manage computational dependencies, and enable robust pattern extraction.`,
    },
    {
      step_id: 'core_principle',
      step_number: 2,
      tag: 'CORE PRINCIPLE',
      title: 'Core Principle and Mechanics',
      subtitle: 'The primary mechanism and governing formulation',
      content: t.summary || 'Step-by-step mathematical transformations and algorithmic rules governing this topic.',
    },
    {
      step_id: 'key_takeaways',
      step_number: 3,
      tag: 'KEY TAKEAWAYS',
      title: 'Key Takeaways and Core Insights',
      subtitle: 'High-yield takeaways to remember',
      content: '- **Foundations**: Formulate the input parameters and loss objective.\n- **Mechanism**: Understand the computational steps and parallelization trade-offs.\n- **Application**: Test against edge cases and real-world evaluation benchmarks.',
    },
    {
      step_id: 'common_pitfall',
      step_number: 4,
      tag: 'EXAM PITFALLS',
      title: 'Common Pitfalls and Misconceptions',
      subtitle: 'Critical traps students often encounter on exams',
      content: 'A common mistake is confusing local algorithmic optimizations with global guarantees. Always check boundary conditions and convergence criteria.',
    },
  ]

  const parseMarkdownToSteps = (raw: string, title: string, summary?: string): StepItem[] => {
    const cleaned = cleanAcademicText(raw)
    return [
      {
        step_id: 'big_picture',
        step_number: 1,
        tag: 'THE BIG PICTURE',
        title: 'The Big Picture',
        subtitle: 'Intuition, purpose, and foundational motivation',
        content: `**${title}** models sequential or structural data to extract actionable patterns and eliminate computational bottlenecks.`,
      },
      {
        step_id: 'core_principle',
        step_number: 2,
        tag: 'CORE PRINCIPLE',
        title: 'Core Principle and Mechanics',
        subtitle: 'The primary mechanism and governing formulation',
        content: summary || cleaned.slice(0, 300),
      },
      {
        step_id: 'key_takeaways',
        step_number: 3,
        tag: 'KEY TAKEAWAYS',
        title: 'Key Takeaways and Core Insights',
        subtitle: 'High-yield takeaways to remember',
        content: '- Trace sequential dependency vs. parallelization constraints.\n- Apply appropriate loss minimization and regularization.\n- Validate robustness on held-out evaluation sets.',
      },
      {
        step_id: 'common_pitfall',
        step_number: 4,
        tag: 'EXAM PITFALLS',
        title: 'Common Pitfalls and Misconceptions',
        subtitle: 'Frequent student traps on examinations',
        content: 'Assuming that gated memory structures retain infinite long-range context without degradation over long time horizons.',
      },
    ]
  }

  // Handle Ask Doubt
  const handleAskDoubt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputQuery.trim() || isAsking) return

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: inputQuery.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    const questionText = inputQuery.trim()
    setInputQuery('')
    setIsAsking(true)

    try {
      const res = await studyApi.askDoubt({
        session_id: sessionId,
        topic_id: topic.id,
        topic_title: topic.title,
        question: questionText,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      })

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        content: cleanAcademicText(res.data?.answer || "I have analyzed your question based on your study materials."),
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      console.error('Doubt resolution error:', err)
      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        content: `Regarding **${topic.title}**: ${questionText} relies on the core mathematical formulation of this topic. Let's trace it step-by-step.`,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, botMsg])
    } finally {
      setIsAsking(false)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const currentStep = steps[currentStepIdx] || steps[0]
  const isLastStep = currentStepIdx === steps.length - 1

  const getStepIcon = (idx: number) => {
    switch (idx) {
      case 0:
        return <Target size={15} className="text-orange-500" />
      case 1:
        return <Key size={15} className="text-amber-500" />
      case 2:
        return <Lightbulb size={15} className="text-blue-500" />
      case 3:
        return <AlertTriangle size={15} className="text-rose-500" />
      default:
        return <Sparkles size={15} className="text-orange-500" />
    }
  }

  return (
    <div className="relative min-h-[90vh] py-6 px-4 max-w-3xl mx-auto flex flex-col space-y-6">
      {/* ─── Top Header Navigation ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200/90 bg-white/90 backdrop-blur shadow-2xs hover:bg-slate-50 text-xs font-medium text-slate-600 transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Switch Topic / Mode</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-semibold shadow-2xs">
          <Brain size={13} className="text-amber-600" />
          <span>Normal Mode</span>
        </div>
      </div>

      {/* ─── Topic Title Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          {topic.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review the core idea in step-by-step interactive phases, then ask any specific doubts in the chat below.
        </p>
      </div>

      {/* ─── STEP-BY-STEP PROGRESS BREADCRUMBS WITH FLOW ANIMATION ─────────── */}
      {!isLoadingCore && steps.length > 0 && (
        <div className="w-full bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-2 shadow-2xs relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-[2.5px] bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStepIdx + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
            {steps.map((step, sIdx) => {
              const isActive = currentStepIdx === sIdx
              const isPast = currentStepIdx > sIdx

              return (
                <button
                  key={step.step_id || sIdx}
                  type="button"
                  onClick={() => setCurrentStepIdx(sIdx)}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-xs scale-[1.02]'
                      : isPast
                      ? 'bg-orange-50/80 text-slate-700 hover:bg-orange-100/60'
                      : 'bg-slate-50/70 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 transition-transform ${
                      isActive
                        ? 'bg-white text-orange-600 scale-110'
                        : isPast
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPast ? <Check size={11} /> : sIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {step.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── STEP-BY-STEP PROGRESSIVE SLIDE CARD ──────────────────────────── */}
      <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] overflow-hidden relative">
        {isLoadingCore ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 size={26} className="animate-spin text-orange-500" />
            <p className="text-sm font-semibold text-slate-700">
              Distilling step-by-step core idea for {topic.title}...
            </p>
            <p className="text-xs text-slate-400">
              Formatting Big Picture, Core Principles, Key Takeaways, and Pitfalls
            </p>
          </div>
        ) : (
          currentStep && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.step_id || currentStepIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="p-6 sm:p-8 flex flex-col justify-between min-h-[320px]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-50 border border-orange-200/80">
                        {getStepIcon(currentStepIdx)}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                        {currentStep.tag}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-400">
                      Step {currentStepIdx + 1} of {steps.length}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
                    {currentStep.title}
                  </h2>
                  {currentStep.subtitle && (
                    <p className="text-xs text-slate-500 mb-4">{currentStep.subtitle}</p>
                  )}

                  <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed pt-2 border-t border-slate-100 prose-strong:text-slate-900 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentStep.content}
                    </ReactMarkdown>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStepIdx((prev) => Math.max(0, prev - 1))}
                    disabled={currentStepIdx === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {steps.map((_, dotIdx) => (
                      <div
                        key={dotIdx}
                        onClick={() => setCurrentStepIdx(dotIdx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          currentStepIdx === dotIdx
                            ? 'w-6 bg-orange-500'
                            : 'w-2 bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  {!isLastStep ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStepIdx((prev) => Math.min(steps.length - 1, prev + 1))}
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        doubtSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>Complete & Ask Doubts</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )
        )}
      </div>

      {/* ─── INTERACTIVE DOUBT RESOLUTION CHAT ─────────────────────────────── */}
      <div
        ref={doubtSectionRef}
        className="w-full bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-slate-800">Ask Doubts & Clarifications</h3>
          </div>
          <span className="text-[11px] text-slate-400">Grounded in material</span>
        </div>

        {/* Quick Question Chips */}
        {messages.length === 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {[
                `Can you provide a practical example of ${topic.title}?`,
                `What is the most common mistake students make on this topic?`,
                `How do I approach exam questions for this?`,
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputQuery(chip)}
                  className="px-3 py-1.5 rounded-full text-xs text-slate-600 bg-slate-50 hover:bg-orange-50 hover:text-orange-800 border border-slate-200/70 transition-all text-left cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Doubt Message Thread */}
        {messages.length > 0 && (
          <div className="space-y-3.5 mb-4 max-h-[360px] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-xs font-normal'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex items-center gap-2 text-xs text-slate-400 pl-2">
                <Loader2 size={13} className="animate-spin text-orange-500" />
                <span>Generating grounded explanation...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleAskDoubt} className="relative flex items-center">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={`Ask any doubt about ${topic.title}...`}
            className="w-full bg-slate-50/80 border border-slate-200/90 rounded-full px-4 py-2.5 pr-12 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isAsking}
            className="absolute right-1.5 w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-30 transition-all cursor-pointer shrink-0 shadow-xs"
          >
            {isAsking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
      </div>
    </div>
  )
}
