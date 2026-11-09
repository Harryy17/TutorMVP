import React from 'react'
import { motion } from 'framer-motion'
import { GitBranch, ChevronRight } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface HierarchyDiagramRendererProps {
  spec: VisualSpecification
  activeNodeId?: string | null
  onSelectNode: (node: VisualNode) => void
}

export const HierarchyDiagramRenderer: React.FC<HierarchyDiagramRendererProps> = ({
  spec,
  activeNodeId,
  onSelectNode,
}) => {
  const nodes = spec.nodes || []
  if (nodes.length === 0) return null

  // Group nodes by level (defaulting level if not provided)
  const levelsMap: Record<number, VisualNode[]> = {}
  nodes.forEach((n, idx) => {
    const lvl = n.level ?? (idx === 0 ? 0 : idx < 3 ? 1 : 2)
    if (!levelsMap[lvl]) levelsMap[lvl] = []
    levelsMap[lvl].push(n)
  })

  const sortedLevels = Object.keys(levelsMap)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="w-full py-4 select-none">
      <div className="flex flex-col gap-5 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        {sortedLevels.map((lvl, lIdx) => {
          const levelNodes = levelsMap[lvl]
          return (
            <div key={lvl} className="flex flex-col items-center">
              {/* Level Category Badge */}
              <div className="mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {lIdx === 0 ? 'Root Classification' : `Tier ${lIdx + 1} Subclasses`}
                </span>
              </div>

              {/* Cards in this Level */}
              <div className="flex flex-wrap items-stretch justify-center gap-3 w-full">
                {levelNodes.map((node) => {
                  const isSelected = activeNodeId === node.id
                  return (
                    <motion.div
                      key={node.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectNode(node)}
                      className={`min-w-[150px] max-w-[240px] flex-1 p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300'
                          : lIdx === 0
                          ? 'bg-blue-50/70 text-slate-900 border-blue-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <GitBranch
                          size={12}
                          className="text-blue-600"
                        />
                        <h4 className="font-semibold text-xs truncate text-slate-900">
                          {node.label}
                        </h4>
                      </div>

                      {node.description && (
                        <p className="text-[11px] leading-snug line-clamp-2 text-slate-600">
                          {node.description}
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {/* Connector line down to next level */}
              {lIdx < sortedLevels.length - 1 && (
                <div className="flex flex-col items-center my-2">
                  <div className="w-[1.5px] h-4 bg-slate-300" />
                  <ChevronRight size={14} className="rotate-90 text-slate-400" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
