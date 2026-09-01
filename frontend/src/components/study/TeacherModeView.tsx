import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, ArrowLeft, ArrowRight,
  Sparkles, BookOpen, Layers, Award, Loader2,
  Lightbulb, AlertTriangle, Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TopicItem } from './TopicCards'
import { streamTeacherLesson } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { cleanAcademicText } from '../../utils/textFormatter'

interface LessonPhase {
  id: string
  number: number
  title: string
  subtitle: string
  icon: 'intro' | 'simple' | 'deep' | 'traps'
  content: string
}

interface TeacherModeViewProps {
  sessionId: string
  topic: TopicItem
  onStartExam: () => void
  onBack: () => void
}

export default function TeacherModeView({
  sessionId,
  topic,
  onStartExam,
  onBack,
}: TeacherModeViewProps) {
  const [rawLesson, setRawLesson] = useState<string>('')
  const [phases, setPhases] = useState<LessonPhase[]>([])
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState<number>(0)
  const [isStreaming, setIsStreaming] = useState<boolean>(true)
  const [isComplete, setIsComplete] = useState<boolean>(false)

  const token = useAuthStore((s) => s.token)

  // Stream teacher lesson and split into 4 structured phases
  useEffect(() => {
    let isCancelled = false
    setRawLesson('')
    setIsStreaming(true)
    setIsComplete(false)

    const abortController = new AbortController()

    streamTeacherLesson({
      sessionId,
      topicId: topic.id,
      topicTitle: topic.title,
      token: token || undefined,
      signal: abortController.signal,
      onToken: (chunk) => {
        if (!isCancelled) {
          setRawLesson((prev) => {
            const updated = prev + chunk
            const parsed = parseLessonIntoPhases(updated, topic)
            setPhases(parsed)
            return updated
          })
        }
      },
      onDone: () => {
        if (!isCancelled) {
          setIsStreaming(false)
          setIsComplete(true)
        }
      },
      onError: (err) => {
        console.error('Teacher stream error:', err)
        if (!isCancelled) {
          setIsStreaming(false)
          setIsComplete(true)
          const fallbackPhases = getDefaultPhases(topic)
          setPhases(fallbackPhases)
        }
      },
    })

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [sessionId, topic.id])

  // Helper to split streamed markdown into 4 pedagogical phases
  const parseLessonIntoPhases = (text: string, t: TopicItem): LessonPhase[] => {
    const sections = text.split(/(?=##\s+(?:[1-5]\.|\d+\.))/)

    const phaseList: LessonPhase[] = [
      {
        id: 'phase_1',
        number: 1,
        title: 'Introduction and Intuition',
        subtitle: 'The foundational motivation and why this topic matters',
        icon: 'intro',
        content: '',
      },
      {
        id: 'phase_2',
        number: 2,
        title: 'Simple Explanation (ELI5)',
        subtitle: 'Intuitive breakdown with clear real-world analogies',
        icon: 'simple',
        content: '',
      },
      {
        id: 'phase_3',
        number: 3,
        title: 'Deep Mechanics and Worked Examples',
        subtitle: 'Step-by-step algorithms, mathematical formulation, and execution',
        icon: 'deep',
        content: '',
      },
      {
        id: 'phase_4',
        number: 4,
        title: 'Key Rules and Exam Traps',
        subtitle: 'Essential takeaways and common pitfalls to avoid on tests',
        icon: 'traps',
        content: '',
      },
    ]

    if (sections.length <= 1) {
      phaseList[0].content = cleanAcademicText(text) || `Preparing comprehensive lecture on **${t.title}**...`
      return phaseList
    }

    sections.forEach((sec) => {
      const lower = sec.toLowerCase()
      const sanitized = cleanAcademicText(sec.replace(/^##\s+[^\n]+\n/, '').trim())

      if (lower.includes('intro') || lower.includes('1.') || lower.includes('intuition')) {
        phaseList[0].content = sanitized
      } else if (lower.includes('simple') || lower.includes('2.') || lower.includes('eli5')) {
        phaseList[1].content = sanitized
      } else if (lower.includes('mechanic') || lower.includes('3.') || lower.includes('worked') || lower.includes('depth')) {
        phaseList[2].content = sanitized
      } else if (lower.includes('takeaway') || lower.includes('4.') || lower.includes('trap') || lower.includes('wrap') || lower.includes('mistake')) {
        phaseList[3].content = sanitized
      }
    })

    return phaseList
  }

  const getDefaultPhases = (t: TopicItem): LessonPhase[] => [
    {
      id: 'phase_1',
      number: 1,
      title: 'Introduction and Intuition',
      subtitle: 'The foundational motivation and why this topic matters',
      icon: 'intro',
      content: `Welcome to this masterclass on **${t.title}**.\n\nThis topic is a foundational pillar in this curriculum. Mastering it provides the analytical toolkit required to solve complex theoretical and applied problems with confidence.`,
    },
    {
      id: 'phase_2',
      number: 2,
      title: 'Simple Explanation (ELI5)',
      subtitle: 'Intuitive breakdown with clear real-world analogies',
      icon: 'simple',
      content: `${t.summary}\n\nThink of this concept like mapping input clues directly to their most probable outcomes through a series of structured mathematical decisions.`,
    },
    {
      id: 'phase_3',
      number: 3,
      title: 'Deep Mechanics and Worked Examples',
      subtitle: 'Step-by-step algorithms, mathematical formulation, and execution',
      icon: 'deep',
      content: `### Core Execution Pipeline\n\n1. **Input Representation**: Formulate features and parameters.\n2. **Optimization**: Minimize the loss/cost function using objective gradients.\n3. **Evaluation**: Validate decision boundaries against test distributions.`,
    },
    {
      id: 'phase_4',
      number: 4,
      title: 'Key Rules and Exam Traps',
      subtitle: 'Essential takeaways and common pitfalls to avoid on tests',
      icon: 'traps',
      content: `### Core Rules for Exam Mastery\n\n- **Rule 1**: Always identify whether the target variable is continuous or categorical.\n- **Rule 2**: Beware of overfitting when parameter counts exceed sample density.\n- **Rule 3**: Check regularization parameters before concluding convergence.`,
    },
  ]

  const activePhase = phases[currentPhaseIdx] || phases[0] || getDefaultPhases(topic)[0]
  const isLastPhase = currentPhaseIdx === (phases.length > 0 ? phases.length - 1 : 3)

  const getPhaseIcon = (iconType: string) => {
    switch (iconType) {
      case 'intro':
        return <Sparkles size={15} className="text-orange-500" />
      case 'simple':
        return <Lightbulb size={15} className="text-amber-500" />
      case 'deep':
        return <Layers size={15} className="text-indigo-500" />
      case 'traps':
        return <AlertTriangle size={15} className="text-rose-500" />
      default:
        return <BookOpen size={15} className="text-orange-500" />
    }
  }

  return (
    <div className="relative min-h-[85vh] py-6 px-4 max-w-3xl mx-auto flex flex-col space-y-6">
      {/* ─── Top Header Navigation ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200/90 bg-white/90 backdrop-blur shadow-2xs hover:bg-slate-50 text-xs font-medium text-slate-600 transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Switch Topic / Mode</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold shadow-xs">
          <GraduationCap size={14} />
          <span>Teacher Mode: Masterclass</span>
        </div>
      </div>

      {/* ─── Topic Title Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          {topic.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete each lecture phase step-by-step, then test your comprehension in the Mastery Exam.
        </p>
      </div>

      {/* ─── PHASE PROGRESS BREADCRUMBS WITH FLOW ANIMATION ───────────────── */}
      {phases.length > 0 && (
        <div className="w-full bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-2 shadow-2xs relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-[2.5px] bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentPhaseIdx + 1) / phases.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
            {phases.map((phase, pIdx) => {
              const isActive = currentPhaseIdx === pIdx
              const isPast = currentPhaseIdx > pIdx

              return (
                <button
                  key={phase.id || pIdx}
                  type="button"
                  onClick={() => setCurrentPhaseIdx(pIdx)}
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
                    {isPast ? <Check size={11} /> : pIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {phase.title.split('(')[0].trim()}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── STEP-BY-STEP PROGRESSIVE LECTURE CARD ────────────────────────── */}
      <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePhase?.id || currentPhaseIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="p-6 sm:p-8 flex flex-col justify-between min-h-[360px]"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-50 border border-orange-200/80">
                    {getPhaseIcon(activePhase?.icon || 'intro')}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                    PHASE {currentPhaseIdx + 1} OF 4 · {activePhase?.title.toUpperCase()}
                  </span>
                </div>

                <span className="text-xs font-semibold text-slate-400">
                  Phase {currentPhaseIdx + 1} of 4
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
                {activePhase?.title}
              </h2>
              {activePhase?.subtitle && (
                <p className="text-xs text-slate-500 mb-4">{activePhase?.subtitle}</p>
              )}

              <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed pt-3 border-t border-slate-100 prose-headings:font-bold prose-headings:text-slate-900 prose-headings:text-base prose-strong:text-slate-900 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activePhase?.content ||
                    (isStreaming
                      ? 'Professor is drafting this lecture phase...'
                      : 'Reviewing foundational material...')}
                </ReactMarkdown>
              </div>

              {isStreaming && (
                <div className="flex items-center gap-2 mt-4 text-xs text-orange-700 font-medium bg-orange-50/60 p-2.5 rounded-xl border border-orange-100">
                  <Loader2 size={13} className="animate-spin text-orange-500" />
                  <span>Delivering live lecture stream...</span>
                </div>
              )}
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentPhaseIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentPhaseIdx === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map((dotIdx) => (
                  <div
                    key={dotIdx}
                    onClick={() => setCurrentPhaseIdx(dotIdx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentPhaseIdx === dotIdx
                        ? 'w-6 bg-orange-500'
                        : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              {!isLastPhase ? (
                <button
                  type="button"
                  onClick={() => setCurrentPhaseIdx((prev) => Math.min(3, prev + 1))}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartExam}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <Award size={14} />
                  <span>Start Topic Exam</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Exam Launch Callout on Final Phase */}
      {isLastPhase && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                Ready for the Topic Mastery Exam?
              </h3>
              <p className="text-xs text-slate-500">
                Mixed evaluation: Conceptual written questions, 4-option quizzes, and fill-in-the-blank items.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartExam}
            className="px-5 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md flex items-center gap-2 shrink-0 transition-all cursor-pointer"
          >
            <span>Take Exam Now</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}
    </div>
  )
}
