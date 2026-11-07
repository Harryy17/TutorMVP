import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Sparkles, CheckCircle2 } from 'lucide-react'
import type { VisualSpecification, TimelineItem, VisualNode } from '../../types/visual'

interface TimelineRendererProps {
  spec: VisualSpecification
  onSelectNode?: (node: VisualNode) => void
}

export const TimelineRenderer: React.FC<TimelineRendererProps> = ({ spec }) => {
  const timelineData = spec.timeline_data || []
  const nodes = spec.nodes || []

  // Combine timelineData or fallback to nodes
  const items: TimelineItem[] =
    timelineData.length > 0
      ? timelineData
      : nodes.map((n, idx) => ({
          time_period: `Era / Phase ${idx + 1}`,
          title: n.label,
          summary: n.description || 'Milestone event or discovery in this developmental stage.',
          significance: n.details || n.value || 'Key inflection point in the progression.',
        }))

  const [activeItemIndex, setActiveItemIndex] = useState<number>(0)

  return (
    <div className="w-full py-4 select-none">
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        {/* Horizontal Milestone Ruler */}
        <div className="relative flex items-center justify-between pb-8 pt-2 overflow-x-auto">
          {/* Continuous Track Line */}
          <div className="absolute top-6 left-6 right-6 h-[2px] bg-slate-200 -z-0" />

          {items.map((item, idx) => {
            const isSelected = activeItemIndex === idx
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveItemIndex(idx)}
                className="relative z-10 flex flex-col items-center min-w-[90px] px-2 group cursor-pointer"
              >
                {/* Milestone Node Dot */}
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-white text-slate-700 border-2 border-slate-300 group-hover:border-blue-400'
                  }`}
                >
                  {idx + 1}
                </motion.div>

                {/* Period Label */}
                <span className="text-[10.5px] font-semibold text-slate-700 mt-2 text-center truncate max-w-[85px]">
                  {item.time_period}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected Milestone Card */}
        {items[activeItemIndex] && (
          <motion.div
            key={activeItemIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200/90"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                <Calendar size={12} /> {items[activeItemIndex].time_period}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Milestone {activeItemIndex + 1} of {items.length}
              </span>
            </div>

            <h3 className="font-semibold text-sm sm:text-base text-slate-900 mt-1">
              {items[activeItemIndex].title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
              {items[activeItemIndex].summary}
            </p>

            {items[activeItemIndex].significance && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-start gap-1.5 text-xs text-slate-700">
                <Sparkles size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Historical Significance: </strong>
                  {items[activeItemIndex].significance}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
