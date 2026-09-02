import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import StudyFlowAnimation from '../components/study/StudyFlowAnimation'
import GeminiStudyChat from '../components/study/GeminiStudyChat'
import SessionSidebar from '../components/study/SessionSidebar'
import NormalModeView from '../components/study/NormalModeView'
import TeacherModeView from '../components/study/TeacherModeView'
import ExamEngine from '../components/study/ExamEngine'
import ExamResults from '../components/study/ExamResults'
import StudyMapDetailPage from '../components/study/StudyMapDetailPage'
import type { TopicItem } from '../components/study/TopicCards'

type ActiveView = 'chat' | 'study_map' | 'normal_mode' | 'teacher_mode' | 'exam' | 'results'

export default function StudyPage() {
  const user = useAuthStore((s) => s.user)
  const userName = user?.username ? user.username.toUpperCase() : 'SREEHARI'

  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [examEvaluation, setExamEvaluation] = useState<any>(null)

  // Extracted from PDF for study map — keep alive for navigation
  const [studyMapTopics, setStudyMapTopics] = useState<TopicItem[]>([])
  const [studyMapSubject, setStudyMapSubject] = useState<string>('')

  // Switch session from sidebar
  const handleSelectSession = (sid: string) => {
    setActiveSessionId(sid)
    setSessionId(sid)
    setActiveView('chat')
  }

  // Create a brand new clean session
  const handleNewSession = () => {
    setActiveSessionId('')
    setSessionId('')
    setStudyMapTopics([])
    setStudyMapSubject('')
    setActiveView('chat')
  }

  // Called when user clicks "Start Study Journey" on the study map panel
  const handleOpenStudyMap = (topics: TopicItem[], subject: string, sid: string) => {
    setStudyMapTopics(topics)
    setStudyMapSubject(subject)
    setSessionId(sid)
    setActiveView('study_map')
  }

  // Called from GeminiStudyChat or StudyMapDetailPage when a mode is selected
  const handleSelectTopicMode = (topic: TopicItem, mode: 'normal' | 'teacher', sid?: string) => {
    setSelectedTopic(topic)
    if (sid) {
      setSessionId(sid)
      setActiveSessionId(sid)
    }
    setActiveView(mode === 'normal' ? 'normal_mode' : 'teacher_mode')
  }

  return (
    <div className="relative min-h-screen flex text-slate-900 font-sans overflow-x-hidden" style={{ background: 'var(--paper)' }}>
      {/* ── Left Navbar / Multi-Session Workspace ── */}
      <SessionSidebar
        currentSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onToggleMobile={setIsMobileSidebarOpen}
      />

      <main className="relative z-10 flex-1 min-w-0 h-screen overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── Page 1: Chat + Split Study Map Panel ─────────────── */}
          {activeView === 'chat' && (
            <motion.div
              key="chat"
              className="h-full w-full"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GeminiStudyChat
                userName={userName}
                activeSessionId={activeSessionId}
                onSessionChange={(newSid) => {
                  setActiveSessionId(newSid)
                  setSessionId(newSid)
                }}
                onSelectTopicMode={(topic, mode, sid) => handleSelectTopicMode(topic, mode, sid)}
                onOpenStudyMap={handleOpenStudyMap}
                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              />
            </motion.div>
          )}



          {/* ── Page 2: Full Study Map Detail Page ───────────────── */}
          {activeView === 'study_map' && (
            <motion.div
              key="study_map"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <StudyMapDetailPage
                topics={studyMapTopics}
                subject={studyMapSubject}
                sessionId={sessionId}
                onBack={() => setActiveView('chat')}
                onSelectTopicMode={(topic, mode) => handleSelectTopicMode(topic, mode)}
              />
            </motion.div>
          )}

          {/* ── Page 3: Normal Mode Step-by-Step ─────────────────── */}
          {activeView === 'normal_mode' && selectedTopic && (
            <motion.div
              key="normal_mode"
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3 }}
            >
              <NormalModeView
                sessionId={sessionId}
                topic={selectedTopic}
                onBack={() => setActiveView(studyMapTopics.length > 0 ? 'study_map' : 'chat')}
              />
            </motion.div>
          )}

          {/* ── Page 4: Teacher Mode Masterclass ─────────────────── */}
          {activeView === 'teacher_mode' && selectedTopic && (
            <motion.div
              key="teacher_mode"
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3 }}
            >
              <TeacherModeView
                sessionId={sessionId}
                topic={selectedTopic}
                onStartExam={() => setActiveView('exam')}
                onBack={() => setActiveView(studyMapTopics.length > 0 ? 'study_map' : 'chat')}
              />
            </motion.div>
          )}

          {/* ── Page 5: Topic Mastery Exam ────────────────────────── */}
          {activeView === 'exam' && selectedTopic && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ExamEngine
                sessionId={sessionId}
                topic={selectedTopic}
                onExamSubmitted={(evalResult) => {
                  setExamEvaluation(evalResult)
                  setActiveView('results')
                }}
                onCancel={() => setActiveView('teacher_mode')}
              />
            </motion.div>
          )}

          {/* ── Page 6: Exam Results ──────────────────────────────── */}
          {activeView === 'results' && selectedTopic && examEvaluation && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
            >
              <ExamResults
                evaluation={examEvaluation}
                topic={selectedTopic}
                onRetake={() => setActiveView('exam')}
                onNextTopic={() => setActiveView(studyMapTopics.length > 0 ? 'study_map' : 'chat')}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
