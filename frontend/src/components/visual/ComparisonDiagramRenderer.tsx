import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GitCompare, Check, Info } from 'lucide-react'
import type { VisualSpecification, VisualNode, ComparisonDimension } from '../../types/visual'

interface ComparisonDiagramRendererProps {
  spec: VisualSpecification
  onSelectNode?: (node: VisualNode) => void
}

export const ComparisonDiagramRenderer: React.FC<ComparisonDiagramRendererProps> = ({ spec }) => {
  const comparisonData = spec.comparison_data || []
  const [activeDimensionIndex, setActiveDimensionIndex] = useState<number | null>(0)

  // Derive Concept A and Concept B labels from title or nodes
  const nodes = spec.nodes || []
  const conceptAName = nodes[0]?.label || 'Approach A'
  const conceptBName = nodes[1]?.label || 'Approach B'

  // If no structured comparison_data was generated, generate default rows from nodes
  const rows: ComparisonDimension[] =
    comparisonData.length > 0
      ? comparisonData
      : [
          {
            dimension: 'Core Mechanism',
            concept_a_value: nodes[0]?.description || 'Primary structural foundation',
            concept_b_value: nodes[1]?.description || 'Alternative architectural pattern',
          },
          {
            dimension: 'Performance & Complexity',
            concept_a_value: nodes[0]?.value || 'Optimized for high-throughput pipelines',
            concept_b_value: nodes[1]?.value || 'Optimized for simplicity & low overhead',
          },
          {
            dimension: 'Ideal Use Case',
            concept_a_value: nodes[0]?.category || 'Large scale production systems',
            concept_b_value: nodes[1]?.category || 'Prototyping & resource-constrained setups',
          },
        ]

  return (
    <div className="w-full py-3 select-none">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-slate-900 text-white p-3.5 text-xs font-semibold items-center">
          <div className="col-span-4 flex items-center gap-1.5 text-slate-300">
            <GitCompare size={13} className="text-blue-400" />
            <span>Dimension</span>
          </div>
          <div className="col-span-4 text-center font-bold text-blue-200 truncate px-1">
            {conceptAName}
          </div>
          <div className="col-span-4 text-center font-bold text-emerald-200 truncate px-1">
            {conceptBName}
          </div>
        </div>

        {/* Comparison Rows */}
        <div className="divide-y divide-slate-100">
          {rows.map((row, idx) => {
            const isHighlighted = activeDimensionIndex === idx

            return (
              <motion.div
                key={idx}
                onClick={() => setActiveDimensionIndex(idx)}
                className={`grid grid-cols-12 p-3.5 text-xs transition-colors cursor-pointer items-center ${
                  isHighlighted ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="col-span-4 pr-2">
                  <span className="font-semibold text-slate-900 block leading-tight">
                    {row.dimension}
                  </span>
                </div>
                <div className="col-span-4 px-2 py-1 rounded bg-blue-50/50 border border-blue-100 text-slate-700 leading-relaxed text-[11.5px]">
                  {row.concept_a_value}
                </div>
                <div className="col-span-4 px-2 py-1 rounded bg-emerald-50/50 border border-emerald-100 text-slate-700 leading-relaxed text-[11.5px] ml-1">
                  {row.concept_b_value}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Selected Dimension Takeaway Banner */}
        {activeDimensionIndex !== null && rows[activeDimensionIndex] && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Key Tradeoff ({rows[activeDimensionIndex].dimension}): </strong>
              Compare how <span className="font-medium text-blue-700">{conceptAName}</span> differs from{' '}
              <span className="font-medium text-emerald-700">{conceptBName}</span> in real-world scenarios.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
