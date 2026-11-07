import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Cpu, Database, Brain, Settings, Sparkles } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface ProcessDiagramRendererProps {
  spec: VisualSpecification
  activeNodeId?: string | null
  onSelectNode: (node: VisualNode) => void
  currentStepIndex: number
}

const getIcon = (hint?: string) => {
  switch (hint?.toLowerCase()) {
    case 'cpu':
      return <Cpu size={14} className="text-blue-600" />
    case 'database':
      return <Database size={14} className="text-emerald-600" />
    case 'brain':
      return <Brain size={14} className="text-purple-600" />
    case 'gear':
      return <Settings size={14} className="text-amber-600" />
    default:
      return <Sparkles size={14} className="text-slate-600" />
  }
}

export const ProcessDiagramRenderer: React.FC<ProcessDiagramRendererProps> = ({
  spec,
  activeNodeId,
  onSelectNode,
  currentStepIndex,
}) => {
  const nodes = spec.nodes || []
  if (nodes.length === 0) return null

  return (
    <div className="w-full py-4 select-none">
      {/* Visual Workflow Flow */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 overflow-x-auto p-2 scrollbar-thin">
        {nodes.map((node, idx) => {
          const isSelected = activeNodeId === node.id || currentStepIndex === idx
          const isPassed = currentStepIndex > idx
          const connectionToNext = spec.connections?.find(
            (c) => c.from_node === node.id && (nodes[idx + 1] ? c.to_node === nodes[idx + 1].id : false)
          )

          return (
            <React.Fragment key={node.id}>
              {/* Process Stage Card */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectNode(node)}
                className={`relative flex-1 min-w-[170px] max-w-[260px] p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30'
                    : isPassed
                    ? 'bg-white border-slate-300 hover:border-slate-400'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Step badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                    {isPassed ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                    )}
                    Stage {idx + 1}
                  </span>
                  <div className="p-1 rounded-md bg-white border border-slate-100 shadow-2xs">
                    {getIcon(node.icon_hint)}
                  </div>
                </div>

                {/* Node Title */}
                <h4 className="font-semibold text-xs text-slate-900 leading-snug line-clamp-2">
                  {node.label}
                </h4>

                {/* Node Short Description */}
                {node.description && (
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal line-clamp-2">
                    {node.description}
                  </p>
                )}

                {/* Value / metric chip */}
                {node.value && (
                  <div className="mt-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 w-fit">
                    {node.value}
                  </div>
                )}
              </motion.div>

              {/* Arrow Connection between Stages */}
              {idx < nodes.length - 1 && (
                <div className="flex flex-col items-center justify-center shrink-0 py-1 md:py-0 md:px-1">
                  <div className="flex items-center text-slate-400">
                    <ArrowRight size={18} className="rotate-90 md:rotate-0 transition-transform" />
                  </div>
                  {connectionToNext?.label && (
                    <span className="text-[9.5px] font-medium text-slate-500 max-w-[80px] text-center truncate mt-0.5">
                      {connectionToNext.label}
                    </span>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
