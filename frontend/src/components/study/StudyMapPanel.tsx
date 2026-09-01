import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Brain, GraduationCap, Clock, ChevronRight, PanelRightClose
} from 'lucide-react'
import type { TopicItem } from './TopicCards'


interface StudyMapPanelProps {
  topics: TopicItem[]
  subject: string
  onStartStudyMap: () => void
  onSelectTopicMode: (topic: TopicItem, mode: 'normal' | 'teacher') => void
  onMinimize?: () => void
}

export default function StudyMapPanel({
  topics,
  subject,
  onStartStudyMap,
  onSelectTopicMode,
  onMinimize,
}: StudyMapPanelProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const getDifficultyBadge = (diff?: string) => {
    const d = (diff || 'Beginner').toLowerCase()
    if (d === 'intermediate' || d === 'medium') {
      return { label: 'Intermediate', bg: 'var(--highlight-soft)', color: '#9A7300' }
    }
    if (d === 'advanced' || d === 'hard') {
      return { label: 'Advanced', bg: 'var(--coral-soft)', color: 'var(--coral)' }
    }
    return { label: 'Beginner', bg: 'var(--sage-soft)', color: 'var(--sage)' }
  }

  const totalTime = topics.reduce((acc, t) => {
    const match = t.estimated_study_time?.match(/(\d+)/)
    return acc + (match ? parseInt(match[1]) : 15)
  }, 0)

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--white)' }}>
      {/* ─── Header ──────────────────────────────── */}
      <div className="flex-shrink-0 pb-4 mb-4" style={{ borderBottom: '1px solid var(--paper-line)' }}>
        <div className="flex items-center justify-between gap-2.5 mb-1.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--ink)' }}
            >
              <BookOpen size={15} style={{ color: 'var(--highlight)' }} />
            </div>
            <div>
              <h2
                className="relative inline-block text-base font-semibold leading-tight"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
              >
                Plan
                <span
                  style={{
                    position: 'absolute',
                    left: '-2px',
                    right: '-2px',
                    bottom: '1px',
                    height: '7px',
                    background: 'var(--highlight)',
                    zIndex: -1,
                    transform: 'rotate(-0.5deg)',
                    opacity: 0.85,
                  }}
                />
              </h2>
            </div>
          </div>

          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              title="Minimize Plan (Full Width Chat)"
              className="p-1.5 rounded-lg transition-colors cursor-pointer text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper)]"
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </div>


        <p className="text-xs truncate mb-3" style={{ color: 'var(--ink-soft)' }}>
          {subject || 'Course Material'} · built from syllabus
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="flex items-center gap-2 p-2.5"
            style={{ border: '1px solid var(--paper-line)', borderRadius: '8px', background: 'var(--white)' }}
          >
            <div>
              <div className="font-semibold text-sm leading-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
                {topics.length}
              </div>
              <div className="text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
                Topics in plan
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 p-2.5"
            style={{ border: '1px solid var(--paper-line)', borderRadius: '8px', background: 'var(--white)' }}
          >
            <div>
              <div className="font-semibold text-sm leading-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
                ~{totalTime} min
              </div>
              <div className="text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
                Total time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stepper Body with Margin Red Line ───── */}
      <div className="flex-1 overflow-y-auto min-h-0 relative pr-1 custom-scrollbar">
        {/* Red Margin Line */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            bottom: '20px',
            left: '14px',
            width: '1.5px',
            background: 'var(--margin-red)',
            opacity: 0.45,
            zIndex: 0,
          }}
        />

        <div className="flex flex-col gap-3" style={{ paddingLeft: '32px' }}>
          {topics.map((topic, idx) => {
            const isHovered = hoveredIdx === idx
            const topicId = topic.id || `topic_${idx + 1}`
            const badge = getDifficultyBadge(topic.difficulty)

            return (
              <div
                key={topicId}
                className="relative transition-all cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  background: 'var(--white)',
                  border: isHovered ? '1px solid var(--ink)' : '1px solid var(--paper-line)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  transform: isHovered ? 'translateX(2px)' : 'none',
                }}
              >
                {/* Step Circle */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-32px',
                    top: '12px',
                    width: '22px',
                    height: '22px',
                    background: 'var(--ink)',
                    color: 'var(--highlight)',
                    borderRadius: '50%',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  {idx + 1}
                </div>

                {/* Topic Content */}
                <p className="text-xs font-semibold leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--ink)' }}>
                  {topic.title}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-semibold"
                    style={{
                      padding: '2px 8px',
                      borderRadius: '100px',
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>

                  <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                    <Clock size={9} />
                    {topic.estimated_study_time || '15 min'}
                  </span>
                </div>

                {/* Mode Select Buttons on Hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2.5 pt-2 flex gap-1.5"
                      style={{ borderTop: '1px solid var(--paper-line)' }}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectTopicMode(topic, 'normal') }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10.5px] font-semibold cursor-pointer transition-all"
                        style={{ background: 'var(--sage-soft)', color: 'var(--sage)', border: '1px solid var(--paper-rule)' }}
                      >
                        <Brain size={10} />
                        <span>Core Idea</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectTopicMode(topic, 'teacher') }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10.5px] font-semibold cursor-pointer transition-all"
                        style={{ background: 'var(--ink)', color: 'var(--highlight)' }}
                      >
                        <GraduationCap size={10} />
                        <span>Teacher</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Action Button directly below the last topic in the flow */}
          <button
            type="button"
            onClick={onStartStudyMap}
            className="w-full flex items-center justify-center gap-2 cursor-pointer transition-transform font-semibold text-xs py-2.5 px-4 mt-2"
            style={{
              background: 'var(--ink)',
              color: 'var(--highlight)',
              borderRadius: '8px',
              border: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <span>Open Full Plan</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}


