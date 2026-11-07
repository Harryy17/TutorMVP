import React from 'react'
import { motion } from 'framer-motion'
import { Network, Sparkles } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface ConceptMapRendererProps {
  spec: VisualSpecification
  activeNodeId?: string | null
  onSelectNode: (node: VisualNode) => void
}

export const ConceptMapRenderer: React.FC<ConceptMapRendererProps> = ({
  spec,
  activeNodeId,
  onSelectNode,
}) => {
  const nodes = spec.nodes || []
  if (nodes.length === 0) return null

  // Central node is typically the first node or highest level
  const centralNode = nodes[0]
  const satelliteNodes = nodes.slice(1)

  return (
    <div className="w-full py-4 select-none">
      <div className="relative p-6 rounded-2xl bg-slate-50/60 border border-slate-200/80 overflow-hidden">
        {/* Decorative Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* Central Core Concept Node */}
        <div className="flex justify-center mb-6">
          <motion.div
            whileHover={{ scale: 1.03 }}
            onClick={() => onSelectNode(centralNode)}
            className={`max-w-md p-4 rounded-xl border text-center transition-all cursor-pointer shadow-xs ${
              activeNodeId === centralNode.id
                ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-100'
                : 'bg-white border-blue-300 hover:border-blue-500'
            }`}
          >
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 bg-blue-100 text-blue-800">
              <Network size={11} /> Central Concept
            </div>
            <h3 className={`font-semibold text-sm ${activeNodeId === centralNode.id ? 'text-white' : 'text-slate-900'}`}>
              {centralNode.label}
            </h3>
            {centralNode.description && (
              <p className={`text-xs mt-1 leading-snug line-clamp-2 ${activeNodeId === centralNode.id ? 'text-blue-100' : 'text-slate-600'}`}>
                {centralNode.description}
              </p>
            )}
          </motion.div>
        </div>

        {/* Connected Satellite Nodes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 relative">
          {satelliteNodes.map((node) => {
            const isSelected = activeNodeId === node.id
            const incomingRel = spec.connections?.find(
              (c) => c.to_node === node.id || c.from_node === node.id
            )

            return (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectNode(node)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Relationship Badge */}
                  {incomingRel?.label && (
                    <div className="mb-1.5">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Sparkles size={9} /> {incomingRel.label}
                      </span>
                    </div>
                  )}

                  <h4 className="font-semibold text-xs text-slate-900">
                    {node.label}
                  </h4>

                  {node.description && (
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug line-clamp-2">
                      {node.description}
                    </p>
                  )}
                </div>

                {node.category && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-medium truncate">{node.category}</span>
                    <span className="text-blue-600 font-semibold hover:underline">Inspect →</span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
