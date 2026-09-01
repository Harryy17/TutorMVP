import React, { useState } from 'react'
import {
  ArrowLeft, BookOpen, Brain, GraduationCap, Clock
} from 'lucide-react'
import type { TopicItem } from './TopicCards'

interface StudyMapDetailPageProps {
  topics: TopicItem[]
  subject: string
  sessionId: string
  onBack: () => void
  onSelectTopicMode: (topic: TopicItem, mode: 'normal' | 'teacher') => void
}

export default function StudyMapDetailPage({
  topics,
  subject,
  sessionId,
  onBack,
  onSelectTopicMode,
}: StudyMapDetailPageProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const totalTime = topics.reduce((acc, t) => {
    const match = t.estimated_study_time?.match(/(\d+)/)
    return acc + (match ? parseInt(match[1]) : 15)
  }, 0)

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

  const toggleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompletedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const firstIncomplete = topics.find((t) => !completedIds.has(t.id || '')) || topics[0]

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
      style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
    >
      {/* Back button */}
      <div className="w-full max-w-[720px] mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
          style={{ color: 'var(--ink-soft)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-soft)')}
        >
          <ArrowLeft size={14} />
          <span>Back to Chat</span>
        </button>
      </div>

      {/* Main Plan Card Container */}
      <div
        className="w-full max-w-[720px] overflow-hidden"
        style={{
          background: 'var(--white)',
          borderRadius: '4px',
          boxShadow: '0 1px 0 var(--paper-rule), 0 24px 48px -24px rgba(27,35,64,0.18)',
        }}
      >
        {/* ─── Header ────────────────────────────────────── */}
        <div className="p-7 sm:p-8" style={{ borderBottom: '1px solid var(--paper-line)' }}>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'var(--ink)',
              }}
            >
              <BookOpen size={17} style={{ color: 'var(--highlight)' }} />
            </div>

            <div>
              <h1
                className="relative inline-block text-2xl font-semibold leading-tight m-0"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
              >
                Plan
                <span
                  style={{
                    position: 'absolute',
                    left: '-3px',
                    right: '-3px',
                    bottom: '1px',
                    height: '9px',
                    background: 'var(--highlight)',
                    zIndex: -1,
                    transform: 'rotate(-0.5deg)',
                    opacity: 0.85,
                  }}
                />
              </h1>
            </div>
          </div>

          <div className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>
            {subject || 'Course Material'} · built from your uploaded syllabus
          </div>

          {/* Stats Row */}
          <div className="flex gap-3 mt-4 flex-wrap sm:flex-nowrap">
            <div
              className="flex-1 flex items-center gap-2.5 p-3"
              style={{
                border: '1px solid var(--paper-line)',
                borderRadius: '8px',
                background: 'var(--white)',
              }}
            >
              <div>
                <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
                  {topics.length}
                </div>
                <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Topics in this plan
                </div>
              </div>
            </div>

            <div
              className="flex-1 flex items-center gap-2.5 p-3"
              style={{
                border: '1px solid var(--paper-line)',
                borderRadius: '8px',
                background: 'var(--white)',
              }}
            >
              <div>
                <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
                  ~{totalTime} min
                </div>
                <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Total time
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Body with Red Margin Line ──────────────────── */}
        <div className="relative p-6 sm:p-8">
          {/* Vertical Red Margin Line */}
          <div
            style={{
              position: 'absolute',
              top: '4px',
              bottom: '30px',
              left: '45px',
              width: '1.5px',
              background: 'var(--margin-red)',
              opacity: 0.5,
              zIndex: 0,
            }}
          />

          <div className="flex flex-col gap-3.5" style={{ paddingLeft: '46px' }}>
            {topics.map((topic, idx) => {
              const topicId = topic.id || `topic_${idx + 1}`
              const isDone = completedIds.has(topicId)
              const badge = getDifficultyBadge(topic.difficulty)
              const isHovered = hoveredIdx === idx

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
                    padding: '16px 18px',
                    transform: isHovered ? 'translateX(2px)' : 'none',
                    opacity: isDone ? 0.65 : 1,
                  }}
                >
                  {/* Step Circle */}
                  <div
                    onClick={(e) => toggleComplete(topicId, e)}
                    title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                    style={{
                      position: 'absolute',
                      left: '-46px',
                      top: '16px',
                      width: '26px',
                      height: '26px',
                      background: isDone ? 'var(--sage)' : 'var(--ink)',
                      color: isDone ? 'var(--white)' : 'var(--highlight)',
                      borderRadius: '50%',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 600,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>

                  {/* Topic Title */}
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{
                      color: 'var(--ink)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      textDecorationColor: 'var(--paper-rule)',
                    }}
                  >
                    {topic.title}
                  </h3>

                  {/* Topic Summary */}
                  {topic.summary && (
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ink-soft)' }}>
                      {topic.summary}
                    </p>
                  )}

                  {/* Topic Meta Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="text-xs font-semibold"
                      style={{
                        padding: '3px 10px',
                        borderRadius: '100px',
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>

                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                      <Clock size={12} />
                      {topic.estimated_study_time || '15 min'}
                    </span>
                  </div>

                  {/* Action Mode Selection */}
                  <div className="mt-3.5 pt-3 flex gap-2" style={{ borderTop: '1px solid var(--paper-line)' }}>
                    <button
                      type="button"
                      onClick={() => onSelectTopicMode(topic, 'normal')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: 'var(--sage-soft)',
                        color: 'var(--sage)',
                        border: '1px solid var(--paper-rule)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sage)'; e.currentTarget.style.color = 'var(--white)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--sage-soft)'; e.currentTarget.style.color = 'var(--sage)' }}
                    >
                      <Brain size={12} />
                      <span>Explore Core Idea</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectTopicMode(topic, 'teacher')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: 'var(--ink)',
                        color: 'var(--highlight)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                    >
                      <GraduationCap size={13} />
                      <span>Teacher Mode</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Primary CTA */}
          {firstIncomplete && (
            <button
              type="button"
              onClick={() => onSelectTopicMode(firstIncomplete, 'teacher')}
              className="mt-6 cursor-pointer transition-transform font-semibold text-sm py-3 px-5"
              style={{
                marginLeft: '46px',
                background: 'var(--ink)',
                color: 'var(--highlight)',
                border: 'none',
                borderRadius: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              Continue: {firstIncomplete.title} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
