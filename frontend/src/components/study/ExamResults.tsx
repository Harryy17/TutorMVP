import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award, CheckCircle2, XCircle, RotateCcw, ArrowRight,
  ChevronDown, ChevronUp, Sparkles, BookOpen, Layers, Check, X
} from 'lucide-react'
import type { TopicItem } from './TopicCards'

interface QuestionResult {
  id: string
  type: string
  prompt: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  score: number
  explanation: string
  feedback: string
}

interface EvaluationData {
  total_questions: number
  earned_score: number
  max_score: number
  percentage: number
  mastery_level: string
  summary_message: string
  results: QuestionResult[]
}

interface ExamResultsProps {
  evaluation: EvaluationData
  topic: TopicItem
  onRetake: () => void
  onNextTopic: () => void
}

export default function ExamResults({
  evaluation,
  topic,
  onRetake,
  onNextTopic,
}: ExamResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const isMastered = (evaluation.percentage || 0) >= 80

  return (
    <div className="relative min-h-[85vh] py-8 px-4 max-w-3xl mx-auto flex flex-col items-center">
      {/* Top Mastery Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-white/95 rounded-3xl border border-slate-200/90 p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8"
      >
        {/* Score Ring / Icon */}
        <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-100"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <motion.path
              className={isMastered ? 'text-emerald-500' : 'text-orange-500'}
              strokeDasharray={`${evaluation.percentage || 0}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              initial={{ strokeDasharray: '0, 100' }}
              animate={{ strokeDasharray: `${evaluation.percentage || 0}, 100` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-black text-slate-900">
              {Math.round(evaluation.percentage || 0)}%
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles size={13} className="text-orange-500" />
          <span>{evaluation.mastery_level || 'Evaluation Complete'}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-serif text-slate-900 font-normal mb-2">
          {topic.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {evaluation.summary_message}
        </p>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mt-6 pt-6 border-t border-slate-100 text-center">
          <div className="bg-slate-50 p-2.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium block">Score</span>
            <span className="text-sm font-bold text-slate-800">
              {evaluation.earned_score} / {evaluation.max_score}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium block">Correct</span>
            <span className="text-sm font-bold text-emerald-600">
              {evaluation.results?.filter((r) => r.is_correct).length || 0}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-medium block">Accuracy</span>
            <span className="text-sm font-bold text-orange-600">
              {Math.round(evaluation.percentage || 0)}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Detailed Question Review List */}
      <div className="w-full mb-8">
        <h2 className="text-sm font-bold text-slate-900 mb-3 px-1 flex items-center justify-between">
          <span>Question-by-Question Review</span>
          <span className="text-xs text-slate-400 font-normal">Click to see explanation</span>
        </h2>

        <div className="space-y-3">
          {evaluation.results?.map((res, idx) => {
            const isExpanded = expandedId === res.id || (!expandedId && idx === 0)

            return (
              <motion.div
                key={res.id || idx}
                className="bg-white/90 rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(res.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        res.is_correct
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-red-50 text-red-600 border border-red-200'
                      }`}
                    >
                      {res.is_correct ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Question {idx + 1} • {res.type.replace('_', ' ')}
                      </span>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 line-clamp-1">
                        {res.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="text-slate-400 shrink-0">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Accordion Body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 pt-1 text-xs border-t border-slate-100 space-y-3"
                    >
                      {/* Full Prompt */}
                      <p className="font-semibold text-slate-900 mt-2">
                        {res.prompt}
                      </p>

                      {/* User answer vs Correct Answer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Your Submitted Answer:
                          </span>
                          <span className="text-slate-800 font-medium break-words">
                            {res.user_answer || '(Blank)'}
                          </span>
                        </div>

                        <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-1">
                            Correct / Model Answer:
                          </span>
                          <span className="text-emerald-900 font-medium break-words">
                            {res.correct_answer}
                          </span>
                        </div>
                      </div>

                      {/* AI Feedback */}
                      {res.feedback && (
                        <div className="bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block mb-1">
                            Examiner Feedback:
                          </span>
                          <p className="text-amber-900 leading-relaxed">
                            {res.feedback}
                          </p>
                        </div>
                      )}

                      {/* Detailed Explanation */}
                      {res.explanation && (
                        <div className="bg-slate-100/70 p-3.5 rounded-xl text-slate-700 leading-relaxed">
                          <strong className="text-slate-900 block mb-0.5">Explanation:</strong>
                          {res.explanation}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <button
          onClick={onRetake}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>Retake Exam</span>
        </button>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNextTopic}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <span>Choose Another Topic</span>
          <ArrowRight size={14} />
        </motion.button>
      </div>
    </div>
  )
}
