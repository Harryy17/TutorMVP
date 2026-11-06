import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Copy, Check, Eye } from 'lucide-react'

// Initialize mermaid once with clean modern aesthetic
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    useMaxWidth: true,
  },
  sequence: {
    useMaxWidth: true,
    showSequenceNumbers: true,
  },
})

interface MermaidRendererProps {
  code: string
  title?: string
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ code, title }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [hasError, setHasError] = useState<boolean>(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const cleanCode = code.trim()

  useEffect(() => {
    let isMounted = true
    const renderDiagram = async () => {
      if (!cleanCode) return
      try {
        const id = `mermaid_${Math.random().toString(36).substring(2, 11)}`
        const { svg } = await mermaid.render(id, cleanCode)
        if (isMounted) {
          setSvgContent(svg)
          setHasError(false)
        }
      } catch (err) {
        console.warn('[MermaidRenderer] Render note:', err)
        if (isMounted) {
          setHasError(true)
        }
      }
    }

    renderDiagram()
    return () => {
      isMounted = false
    }
  }, [cleanCode])

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.2, 2.5))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.2, 0.5))
  const handleResetZoom = () => setZoomLevel(1.0)
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {}
  }

  if (hasError) {
    return (
      <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 font-mono text-xs text-amber-900">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-amber-800">Visual Diagram (Code View)</span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 cursor-pointer"
          >
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11.5px]">
          {cleanCode}
        </pre>
      </div>
    )
  }

  return (
    <div
      className={`my-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-white/95 backdrop-blur-md shadow-2xl p-4' : ''
      }`}
    >
      {/* Header Controls Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11.5px] font-semibold text-slate-700">
            {title || 'Interactive Visual Diagram'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            title="Copy Diagram Code"
          >
            {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Diagram Canvas Container */}
      <div
        ref={containerRef}
        className={`flex items-center justify-center overflow-auto p-4 transition-transform duration-200 ${
          isFullscreen ? 'flex-1 p-8' : 'min-h-[160px] max-h-[500px]'
        }`}
      >
        {svgContent ? (
          <div
            className="flex items-center justify-center transition-transform origin-center"
            style={{ transform: `scale(${zoomLevel})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span>Rendering visual diagram...</span>
          </div>
        )}
      </div>
    </div>
  )
}

