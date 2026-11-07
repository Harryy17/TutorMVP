import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, CheckCircle2, Sparkles, BookOpen } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface StepByStepRendererProps {
  spec: VisualSpecification
  currentStepIndex: number
  onStepChange: (index: number) => void
  onSelectNode: (node: VisualNode) => void
}

export const StepByStepRenderer: React.FC<StepByStepRendererProps> = ({
  spec,
  currentStepIndex,
  onStepChange,
  onSelectNode,
}) => {
  const steps = spec.nodes || []
  if (steps.length === 0) return null

  const activeStep = steps[currentStepIndex] || steps[0]

  return (
    <div className="w-full py-2 select-none">
      {/* Step Pills Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 border-b border-slate-100">
        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex
          const isDone = idx < currentStepIndex
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                onStepChange(idx)
                onSelectNode(step)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={12} className="text-emerald-600" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
              )}
              <span className="truncate max-w-[120px]">{step.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active Step Hero View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.18 }}
          className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              <Sparkles size={11} /> Step {currentStepIndex + 1} of {steps.length}
            </span>
            {activeStep.category && (
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {activeStep.category}
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-1">
            {activeStep.label}
          </h3>

          {activeStep.description && (
            <p className="text-xs sm:text-sm text-slate-700 mt-1.5 leading-relaxed">
              {activeStep.description}
            </p>
          )}

          {activeStep.details && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
              <BookOpen size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 font-medium">Core Mechanism: </strong>
                {activeStep.details}
              </div>
            </div>
          )}

          {/* Stepper controls */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => {
                const prev = Math.max(0, currentStepIndex - 1)
                onStepChange(prev)
                onSelectNode(steps[prev])
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span className="text-xs text-slate-500 font-medium">
              {currentStepIndex + 1} / {steps.length}
            </span>

            <button
              type="button"
              disabled={currentStepIndex === steps.length - 1}
              onClick={() => {
                const next = Math.min(steps.length - 1, currentStepIndex + 1)
                onStepChange(next)
                onSelectNode(steps[next])
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
