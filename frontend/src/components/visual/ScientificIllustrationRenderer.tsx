import React from 'react'
import { motion } from 'framer-motion'
import { Activity, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface ScientificIllustrationRendererProps {
  spec: VisualSpecification
  activeNodeId?: string | null
  onSelectNode: (node: VisualNode) => void
}

export const ScientificIllustrationRenderer: React.FC<ScientificIllustrationRendererProps> = ({
  spec,
  activeNodeId,
  onSelectNode,
}) => {
  const nodes = spec.nodes || []
  if (nodes.length === 0) return null

  // Categorize nodes into Inputs, Mechanisms / Internal States, and Outputs
  const inputs = nodes.filter((n) => n.status === 'input' || n.category?.toLowerCase().includes('input'))
  const outputs = nodes.filter((n) => n.status === 'output' || n.category?.toLowerCase().includes('output'))
  const mechanisms = nodes.filter((n) => !inputs.includes(n) && !outputs.includes(n))

  // Fallback partitioning if no tags
  const effectiveInputs = inputs.length > 0 ? inputs : [nodes[0]]
  const effectiveOutputs = outputs.length > 0 ? outputs : (nodes.length > 2 ? [nodes[nodes.length - 1]] : [])
  const effectiveMechanisms =
    mechanisms.length > 0
      ? mechanisms
      : nodes.filter((n) => !effectiveInputs.includes(n) && !effectiveOutputs.includes(n))

  return (
    <div className="w-full py-4 select-none">
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-xs">
        {/* Scientific Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
              <Activity size={15} />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              Technical System Mechanism & Reaction Cycle
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
            System Boundary
          </span>
        </div>

        {/* 3-Column System Architecture: Inputs -> Internal Mechanisms -> Outputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
          {/* 1. System Inputs */}
          <div className="md:col-span-3 flex flex-col gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
              Inflow / Substrates
            </span>
            {effectiveInputs.map((node) => (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onSelectNode(node)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  activeNodeId === node.id
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold text-xs">{node.label}</div>
                {node.description && (
                  <div className="text-[10.5px] opacity-80 mt-0.5 line-clamp-2">
                    {node.description}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Flow Connector Arrow */}
          <div className="md:col-span-1 flex items-center justify-center text-slate-500 py-1 md:py-0">
            <ArrowRight size={18} className="rotate-90 md:rotate-0" />
          </div>

          {/* 2. Internal Mechanism / Chamber */}
          <div className="md:col-span-4 flex flex-col gap-2 p-3 rounded-xl bg-slate-800/80 border border-emerald-500/30 ring-1 ring-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <Sparkles size={10} /> Core Transformation
            </span>
            {effectiveMechanisms.map((node) => (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onSelectNode(node)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  activeNodeId === node.id
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-emerald-500/50'
                }`}
              >
                <div className="font-semibold text-xs">{node.label}</div>
                {node.description && (
                  <div className="text-[10.5px] opacity-80 mt-0.5 line-clamp-2">
                    {node.description}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Flow Connector Arrow */}
          <div className="md:col-span-1 flex items-center justify-center text-slate-500 py-1 md:py-0">
            <ArrowRight size={18} className="rotate-90 md:rotate-0" />
          </div>

          {/* 3. System Outputs */}
          <div className="md:col-span-3 flex flex-col gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
              Outflow / Products
            </span>
            {effectiveOutputs.map((node) => (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onSelectNode(node)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  activeNodeId === node.id
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="font-semibold text-xs">{node.label}</div>
                {node.description && (
                  <div className="text-[10.5px] opacity-80 mt-0.5 line-clamp-2">
                    {node.description}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
