import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, Copy, Check, Maximize2, Minimize2,
  X, Code2, Sparkles, BookOpen, PanelLeft, PanelRight, ChevronDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { exportNotesToPdf } from '../../utils/exportPdf'

interface MarkdownArtifactViewerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  markdown: string
  onDownload: () => void
  isDownloading?: boolean
  position?: 'left' | 'right'
  onTogglePosition?: () => void
}

export default function MarkdownArtifactViewer({
  isOpen,
  onClose,
  title,
  markdown,
  onDownload,
  isDownloading = false,
  position = 'right',
  onTogglePosition,
}: MarkdownArtifactViewerProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview')
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy markdown:', err)
    }
  }

  const cleanTitle = title || 'Study Notes'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: position === 'left' ? -40 : 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: position === 'left' ? -40 : 40 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className={`h-full flex flex-col bg-white ${
          position === 'left' ? 'border-r' : 'border-l'
        } border-slate-200 shadow-xl transition-all duration-300 z-30 ${
          isExpanded
            ? 'fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[60vw]'
            : 'w-full lg:w-[500px] xl:w-[560px]'
        }`}
      >
        {/* ── Header (Claude Artifact Style) ── */}
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-xs select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
              <Code2 size={15} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[280px]">
                {cleanTitle}
              </h3>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-bold shrink-0">
                MD
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Tab Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-200/60 mr-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('source')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeTab === 'source'
                    ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Raw
              </button>
            </div>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Copy markdown text"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Download Dropdown (MD & PDF) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Download options"
              >
                <Download size={13} className="text-emerald-700" />
                <span>Export</span>
                <ChevronDown size={11} className="text-emerald-600" />
              </button>

              {isDownloadMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs select-none"
                  onClick={() => setIsDownloadMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <FileText size={13} className="text-slate-500" />
                    <span>Download as .md</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportNotesToPdf(cleanTitle, 'artifact-viewer-canvas')}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50/50 flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                  >
                    <Download size={13} className="text-emerald-600" />
                    <span>Download as PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Dock Position Toggle (Left / Right) */}
            {onTogglePosition && (
              <button
                type="button"
                onClick={onTogglePosition}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer hidden sm:flex"
                title={position === 'left' ? 'Move viewer to right side' : 'Move viewer to left side'}
              >
                {position === 'left' ? <PanelRight size={15} /> : <PanelLeft size={15} />}
              </button>
            )}

            {/* Expand / Minimize Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer hidden sm:flex"
              title={isExpanded ? 'Restore width' : 'Expand full width'}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close viewer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Document Canvas ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-white">
          <div className="max-w-3xl mx-auto">
            {activeTab === 'preview' ? (
              <article id="artifact-viewer-canvas" className="markdown-content font-serif text-slate-900 leading-relaxed space-y-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {markdown}
                </ReactMarkdown>
              </article>
            ) : (
              <pre className="text-xs font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                {markdown}
              </pre>
            )}
          </div>
        </div>

        {/* ── Footer Status Bar ── */}
        <div className="h-9 px-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Grounded Academic Reference Doc</span>
          </div>
          <span>{markdown.length} characters</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
