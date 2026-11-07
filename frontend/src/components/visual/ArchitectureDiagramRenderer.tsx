import React from 'react'
import { motion } from 'framer-motion'
import { Layers, ArrowDown, Database, Server, Smartphone, Globe, ShieldCheck } from 'lucide-react'
import type { VisualSpecification, VisualNode } from '../../types/visual'

interface ArchitectureDiagramRendererProps {
  spec: VisualSpecification
  activeNodeId?: string | null
  onSelectNode: (node: VisualNode) => void
}

const getTierIcon = (category?: string, label?: string) => {
  const text = `${category || ''} ${label || ''}`.toLowerCase()
  if (text.includes('client') || text.includes('user') || text.includes('browser') || text.includes('mobile')) {
    return <Smartphone size={15} className="text-blue-500" />
  }
  if (text.includes('gateway') || text.includes('api') || text.includes('proxy') || text.includes('router')) {
    return <Globe size={15} className="text-indigo-500" />
  }
  if (text.includes('auth') || text.includes('security')) {
    return <ShieldCheck size={15} className="text-amber-500" />
  }
  if (text.includes('database') || text.includes('store') || text.includes('cache') || text.includes('redis') || text.includes('sql')) {
    return <Database size={15} className="text-emerald-500" />
  }
  return <Server size={15} className="text-purple-500" />
}

export const ArchitectureDiagramRenderer: React.FC<ArchitectureDiagramRendererProps> = ({
  spec,
  activeNodeId,
  onSelectNode,
}) => {
  const nodes = spec.nodes || []
  if (nodes.length === 0) return null

  // Group nodes by category or tier
  const tiers: { name: string; nodes: VisualNode[] }[] = []
  nodes.forEach((n) => {
    const cat = n.category || 'System Services'
    let tier = tiers.find((t) => t.name === cat)
    if (!tier) {
      tier = { name: cat, nodes: [] }
      tiers.push(tier)
    }
    tier.nodes.push(n)
  })

  return (
    <div className="w-full py-4 select-none">
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
        {tiers.map((tier, tIdx) => (
          <React.Fragment key={tier.name}>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Layers size={12} className="text-slate-400" />
                  {tier.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Tier {tIdx + 1}
                </span>
              </div>

              {/* Tier Components Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {tier.nodes.map((node) => {
                  const isSelected = activeNodeId === node.id

                  return (
                    <motion.div
                      key={node.id}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => onSelectNode(node)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300'
                          : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-white border border-slate-200 shadow-2xs">
                          {getTierIcon(node.category, node.label)}
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 truncate">
                          {node.label}
                        </h4>
                      </div>

                      {node.description && (
                        <p className="text-[11px] text-slate-600 mt-1.5 leading-snug line-clamp-2">
                          {node.description}
                        </p>
                      )}

                      {node.value && (
                        <div className="mt-2 text-[9.5px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                          {node.value}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Directional Downward Data Flow Arrow between Tiers */}
            {tIdx < tiers.length - 1 && (
              <div className="flex items-center justify-center -my-1 text-slate-400">
                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-mono text-slate-500 shadow-2xs">
                  <ArrowDown size={11} className="text-blue-500" />
                  <span>Request / Response Protocol</span>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
