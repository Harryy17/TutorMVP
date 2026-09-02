import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  BookOpen,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Layers,
  MessageSquare,
  X,
} from 'lucide-react'
import { studyApi } from '../../services/api'
import type { StudySessionMeta } from '../../services/api'

interface SessionSidebarProps {
  currentSessionId: string
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen?: boolean
  onToggleMobile?: (open: boolean) => void
}

export default function SessionSidebar({
  currentSessionId,
  onSelectSession,
  onNewSession,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onToggleMobile,
}: SessionSidebarProps) {

  const [sessions, setSessions] = useState<StudySessionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSessions = async () => {
    try {
      const res = await studyApi.listSessions()
      if (res.data) {
        setSessions(res.data)
      }
    } catch (err) {
      console.error('Failed to load study sessions:', err)
    }
  }


  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [currentSessionId])

  const handleDelete = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this study session and its isolated database?')) return
    setDeletingId(sid)
    try {
      await studyApi.deleteSession(sid)
      setSessions((prev) => prev.filter((s) => s.session_id !== sid))
      if (currentSessionId === sid) {
        onNewSession()
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      const now = new Date()
      const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000)
      if (diffMins < 2) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  const renderSidebarContent = (isMobile = false) => {
    const collapsed = isMobile ? false : isCollapsed

    return (
      <div className="flex flex-col h-full select-none">
        {/* ── Header & New Session ── */}
        <div className="p-3 border-b border-[var(--paper-rule)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2
                  className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Workspaces
                </h2>
              </div>
            )}
            {isMobile ? (
              <button
                onClick={() => onToggleMobile && onToggleMobile(false)}
                title="Close Workspaces"
                className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--sage-soft)] transition-colors ml-auto cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--sage-soft)] transition-colors ml-auto cursor-pointer"
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* New Session Button */}
          <button
            onClick={() => {
              onNewSession()
              if (isMobile && onToggleMobile) onToggleMobile(false)
            }}
            title="Start Fresh Study Session"
            className={`flex items-center justify-center gap-2 rounded-xl transition-all duration-150 font-medium cursor-pointer ${
              collapsed
                ? 'p-2.5 bg-[var(--ink)] text-[var(--paper)] hover:bg-slate-800 shadow-sm'
                : 'w-full py-2.5 px-3 bg-[var(--ink)] text-[var(--paper)] hover:bg-slate-800 shadow-sm text-sm'
            }`}
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>New Session</span>}
          </button>
        </div>

        {/* ── Sessions List ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
          {!collapsed && sessions.length === 0 && (
            <div className="text-center py-10 px-3 text-xs text-[var(--ink-soft)] italic">
              No past sessions yet.
              <br />
              Click <strong className="font-semibold text-[var(--ink)]">+ New Session</strong> to begin!
            </div>
          )}

          {sessions.map((s) => {
            const isActive = s.session_id === currentSessionId

            return (
              <div
                key={s.session_id}
                onClick={() => {
                  onSelectSession(s.session_id)
                  if (isMobile && onToggleMobile) onToggleMobile(false)
                }}
                className={`group relative flex items-center gap-2.5 p-2.5 sm:p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#EBF1ED] border border-emerald-300/80 shadow-xs'
                    : 'hover:bg-[var(--sage-soft)] border border-transparent active:bg-[var(--sage-soft)]'
                }`}
              >
                {/* Left Indicator Icon */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[var(--paper-rule)] text-[var(--ink-soft)] group-hover:bg-slate-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </div>

                {/* Title & Metadata (Expanded only) */}
                {!collapsed && (
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-[var(--ink)] font-bold' : 'text-[var(--ink)]'
                        }`}
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        {s.title || s.subject || 'Study Session'}
                      </p>
                      <span className="text-[10px] text-[var(--ink-soft)] flex-shrink-0">
                        {formatTime(s.last_active)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded-full border"
                        style={{
                          background: isActive ? '#DCFCE7' : 'var(--sage-soft)',
                          borderColor: isActive ? '#86EFAC' : 'var(--paper-rule)',
                          color: isActive ? '#15803D' : 'var(--ink-soft)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {s.subject || 'General'}
                      </span>
                      {s.topics_count > 0 && (
                        <span className="text-[10px] text-[var(--ink-soft)] flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5 opacity-70" />
                          {s.topics_count}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Delete Button (Expanded only) */}
                {!collapsed && (
                  <button
                    onClick={(e) => handleDelete(e, s.session_id)}
                    disabled={deletingId === s.session_id}
                    title="Delete Session & Database"
                    className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1.5 sm:p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-all flex-shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Bottom Database Isolation Badge ── */}
        <div className="p-2.5 border-t border-[var(--paper-rule)] bg-[var(--paper)]">
          {!collapsed ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--sage-soft)] border border-[var(--paper-rule)] text-[10px] text-[var(--ink-soft)]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-[var(--ink)]">Isolated DBs</span>
                <p className="truncate text-[9px] opacity-80">1 SQLite per subject</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Isolated Databases: 100% Zero-Bleed">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop Docked Sidebar (Hidden on mobile) ── */}
      <aside
        className={`hidden md:flex relative flex-col h-screen transition-all duration-300 z-30 select-none ${
          isCollapsed ? 'w-16' : 'w-72'
        }`}
        style={{
          background: 'var(--paper)',
          borderRight: '1px solid var(--paper-rule)',
          boxShadow: '1px 0 6px rgba(27,35,64,0.02)',
        }}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* ── Mobile Slide-Over Drawer with Backdrop ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onToggleMobile && onToggleMobile(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Slide-out Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10"
              style={{
                background: 'var(--paper)',
                borderRight: '1px solid var(--paper-rule)',
              }}
            >
              {renderSidebarContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

