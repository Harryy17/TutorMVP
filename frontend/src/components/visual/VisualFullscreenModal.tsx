import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'
import type { VisualSpecification } from '../../types/visual'

interface VisualFullscreenModalProps {
  isOpen: boolean
  onClose: () => void
  spec: VisualSpecification
  children: React.ReactNode
}

export const VisualFullscreenModal: React.FC<VisualFullscreenModalProps> = ({
  isOpen,
  onClose,
  spec,
  children,
}) => {
  const [zoom, setZoom] = useState<number>(1.0)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded">
                {spec.visual_type.replace('_', ' ')}
              </span>
              <h2 className="text-base font-semibold text-slate-900 mt-1">{spec.title}</h2>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-[11px] font-mono text-slate-500 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1.0)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Close Fullscreen View"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body Container with Scalable Zoom */}
          <div className="flex-1 overflow-auto p-6 bg-slate-50/40 flex items-center justify-center">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                width: '100%',
              }}
            >
              {children}
            </div>
          </div>

          {/* Modal Footer Captions */}
          {spec.captions && (
            <div className="px-5 py-2.5 bg-white border-t border-slate-200 text-xs text-slate-600">
              <strong className="text-slate-800">Key Takeaway: </strong>
              {spec.captions}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
