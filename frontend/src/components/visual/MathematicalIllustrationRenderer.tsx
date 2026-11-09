import React, { useState } from 'react'
import { motion } from 'framer-motion'
import katex from 'katex'
import { Sigma, BookOpen, Activity, Info } from 'lucide-react'
import type { VisualSpecification, MathVariable } from '../../types/visual'

interface MathematicalIllustrationRendererProps {
  spec: VisualSpecification
}

export const MathematicalIllustrationRenderer: React.FC<MathematicalIllustrationRendererProps> = ({ spec }) => {
  const mathData = spec.math_data
  const primaryFormula = mathData?.primary_formula || '$$ v = u + at $$'
  const rawLatex = primaryFormula.replace(/^\$\$|\$\$$/g, '').trim()

  const titleLower = (spec.title || '').toLowerCase()
  const intuitionLower = (mathData?.intuition || '').toLowerCase()
  const isVelocityTimeGraph =
    mathData?.graph_type === 'velocity_time' ||
    titleLower.includes('velocity') ||
    titleLower.includes('motion') ||
    titleLower.includes('acceleration') ||
    titleLower.includes('kinematic') ||
    intuitionLower.includes('velocity') ||
    intuitionLower.includes('slope') ||
    intuitionLower.includes('displacement')

  const variables: MathVariable[] =
    mathData?.variables && mathData.variables.length > 0
      ? mathData.variables
      : isVelocityTimeGraph
      ? [
          { symbol: 'v', name: 'Final Velocity', description: 'Velocity reached after accelerating over time t.' },
          { symbol: 'u', name: 'Initial Velocity', description: 'Starting velocity of the object at time t = 0.' },
          { symbol: 'a', name: 'Uniform Acceleration', description: 'Slope of the v-t graph; constant rate of change of velocity.' },
          { symbol: 't', name: 'Time Elapsed', description: 'Duration over which acceleration occurs.' },
          { symbol: 's', name: 'Displacement', description: 'Total distance traveled; equal to the area under the v-t graph.' },
        ]
      : [
          { symbol: 'W', name: 'Weight Matrix', description: 'Trainable parameters determining feature significance.' },
          { symbol: 'x', name: 'Input Vector', description: 'Raw feature vector or embedding passed into the layer.' },
          { symbol: 'b', name: 'Bias Term', description: 'Affine offset allowing the model to shift the activation curve.' },
          { symbol: '\\sigma', name: 'Activation Function', description: 'Non-linear transformation introducing expressive power.' },
        ]

  const [selectedVar, setSelectedVar] = useState<MathVariable>(variables[0])
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)

  // Safely render formula with KaTeX
  let renderedFormulaHtml = ''
  try {
    renderedFormulaHtml = katex.renderToString(rawLatex, {
      throwOnError: false,
      displayMode: true,
    })
  } catch {
    renderedFormulaHtml = `<div class="font-mono text-center py-2">${rawLatex}</div>`
  }

  return (
    <div className="w-full py-3 select-none">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all hover:shadow-sm">
        {/* Graph / Diagram Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h3 className="font-semibold text-sm text-slate-900 tracking-tight">
              {isVelocityTimeGraph ? 'Velocity-Time Graph' : spec.title || 'Mathematical Model'}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-2xs">
            {isVelocityTimeGraph ? 'Kinematics 2D Plot' : 'Interactive Formulation'}
          </span>
        </div>

        {/* 2D Vector Coordinate Graph (Exact Match to Syllabus Figure) */}
        {isVelocityTimeGraph && (
          <div className="p-4 sm:p-6 bg-white flex flex-col items-center justify-center border-b border-slate-100">
            <div className="w-full max-w-[540px] relative">
              <svg
                viewBox="0 0 540 330"
                className="w-full h-auto overflow-visible"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.02))' }}
              >
                <defs>
                  {/* Arrow marker for coordinate axes */}
                  <marker
                    id="axis-arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
                  </marker>
                </defs>

                {/* Shaded Area: Displacement (Trapezoid from 0 to t under the line) */}
                <motion.polygon
                  points="75,190 400,80 400,270 75,270"
                  fill="#dbeafe"
                  fillOpacity={hoveredElement === 'displacement' ? '0.9' : '0.75'}
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => {
                    setHoveredElement('displacement')
                    const match = variables.find((v) => v.symbol === 's')
                    if (match) setSelectedVar(match)
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                />

                {/* Shaded Area Label */}
                <text
                  x="245"
                  y="235"
                  textAnchor="middle"
                  className="font-bold fill-blue-600 text-[17px] tracking-wide pointer-events-none select-none"
                >
                  Displacement (area)
                </text>

                {/* Dashed Horizontal Line from u to vertical projection */}
                <line
                  x1="75"
                  y1="190"
                  x2="400"
                  y2="190"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="5,5"
                />

                {/* Dashed Vertical Line from (t, v) down to t on Time axis */}
                <line
                  x1="400"
                  y1="80"
                  x2="400"
                  y2="270"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="5,5"
                />

                {/* Coordinate Axes */}
                {/* Y Axis: Velocity */}
                <line
                  x1="75"
                  y1="270"
                  x2="75"
                  y2="35"
                  stroke="#1e293b"
                  strokeWidth="2.5"
                  markerEnd="url(#axis-arrow)"
                />
                <text
                  x="75"
                  y="22"
                  textAnchor="middle"
                  className="font-semibold text-[17px] fill-slate-900 select-none"
                >
                  Velocity
                </text>

                {/* X Axis: Time */}
                <line
                  x1="75"
                  y1="270"
                  x2="480"
                  y2="270"
                  stroke="#1e293b"
                  strokeWidth="2.5"
                  markerEnd="url(#axis-arrow)"
                />
                <text
                  x="498"
                  y="295"
                  textAnchor="start"
                  className="font-semibold text-[17px] fill-slate-900 select-none"
                >
                  Time
                </text>

                {/* Origin Label '0' */}
                <text
                  x="60"
                  y="290"
                  textAnchor="end"
                  className="font-mono text-[16px] fill-slate-800 select-none"
                >
                  0
                </text>

                {/* Initial Velocity 'u' on Y-axis */}
                <text
                  x="54"
                  y="196"
                  textAnchor="end"
                  className="font-serif italic font-semibold text-[18px] fill-slate-900 select-none cursor-pointer"
                  onClick={() => {
                    const match = variables.find((v) => v.symbol === 'u')
                    if (match) setSelectedVar(match)
                  }}
                >
                  u
                </text>

                {/* Final Velocity 'v' */}
                <text
                  x="422"
                  y="86"
                  textAnchor="start"
                  className="font-serif italic font-semibold text-[18px] fill-slate-900 select-none cursor-pointer"
                  onClick={() => {
                    const match = variables.find((v) => v.symbol === 'v')
                    if (match) setSelectedVar(match)
                  }}
                >
                  v
                </text>

                {/* Time 't' label on X-axis */}
                <text
                  x="400"
                  y="296"
                  textAnchor="middle"
                  className="font-serif italic font-semibold text-[18px] fill-slate-900 select-none cursor-pointer"
                  onClick={() => {
                    const match = variables.find((v) => v.symbol === 't')
                    if (match) setSelectedVar(match)
                  }}
                >
                  t
                </text>

                {/* Slanted Motion Line: Acceleration */}
                <line
                  x1="75"
                  y1="190"
                  x2="400"
                  y2="80"
                  stroke="#2563eb"
                  strokeWidth={hoveredElement === 'acceleration' ? '5.5' : '4.5'}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => {
                    setHoveredElement('acceleration')
                    const match = variables.find((v) => v.symbol === 'a')
                    if (match) setSelectedVar(match)
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                />

                {/* Acceleration Label along the slope */}
                <text
                  x="235"
                  y="125"
                  textAnchor="middle"
                  className="font-bold fill-blue-600 text-[18px] select-none cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredElement('acceleration')
                    const match = variables.find((v) => v.symbol === 'a')
                    if (match) setSelectedVar(match)
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  Acceleration
                </text>

                {/* Dot at (0, u) */}
                <circle
                  cx="75"
                  cy="190"
                  r="7"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => {
                    const match = variables.find((v) => v.symbol === 'u')
                    if (match) setSelectedVar(match)
                  }}
                />

                {/* Dot at (t, v) */}
                <circle
                  cx="400"
                  cy="80"
                  r="7"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => {
                    const match = variables.find((v) => v.symbol === 'v')
                    if (match) setSelectedVar(match)
                  }}
                />
              </svg>

              {/* Caption Underneath Graph */}
              <p className="text-xs text-slate-500 text-center mt-2.5 font-medium">
                The slope of this graph represents <strong>acceleration</strong>, and the area underneath it represents <strong>displacement</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Formula Hero Display */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col items-center justify-center relative">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5">
            <Sigma size={14} /> Key Governing Equation
          </div>

          <div
            className="text-lg sm:text-2xl text-center overflow-x-auto py-1.5 max-w-full text-white"
            dangerouslySetInnerHTML={{ __html: renderedFormulaHtml }}
          />

          {mathData?.intuition && !isVelocityTimeGraph && (
            <p className="text-xs text-slate-300 text-center mt-2 max-w-lg leading-relaxed italic">
              "{mathData.intuition}"
            </p>
          )}
        </div>

        {/* Interactive Variable Callout Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Interactive Variable Inspection (Click to Deconstruct):
          </span>
          <div className="flex flex-wrap gap-2">
            {variables.map((v, idx) => {
              const isSelected = selectedVar?.symbol === v.symbol
              let varHtml = ''
              try {
                varHtml = katex.renderToString(v.symbol, { throwOnError: false })
              } catch {
                varHtml = v.symbol
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedVar(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="font-serif font-bold text-sm"
                    dangerouslySetInnerHTML={{ __html: varHtml }}
                  />
                  <span>: {v.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Variable Detail Card */}
        {selectedVar && (
          <motion.div
            key={selectedVar.symbol}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-slate-900">{selectedVar.name}</h4>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Symbol: {selectedVar.symbol}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedVar.description}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
