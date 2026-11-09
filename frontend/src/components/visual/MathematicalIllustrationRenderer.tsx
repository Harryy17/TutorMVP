import React, { useState } from 'react'
import { motion } from 'framer-motion'
import katex from 'katex'
import { Sigma, BookOpen } from 'lucide-react'
import type { VisualSpecification, MathVariable, CoordinatePlotData } from '../../types/visual'

interface MathematicalIllustrationRendererProps {
  spec: VisualSpecification
}

export const MathematicalIllustrationRenderer: React.FC<MathematicalIllustrationRendererProps> = ({ spec }) => {
  const mathData = spec.math_data
  const primaryFormula = mathData?.primary_formula || '$$ v = u + at $$'
  const rawLatex = primaryFormula.replace(/^\$\$|\$\$$/g, '').trim()

  const plotData: CoordinatePlotData | undefined = mathData?.plot_data

  const variables: MathVariable[] =
    mathData?.variables && mathData.variables.length > 0
      ? mathData.variables
      : [
          { symbol: 'v', name: 'Final Velocity', description: 'Velocity reached after accelerating over time t.' },
          { symbol: 'u', name: 'Initial Velocity', description: 'Starting velocity of the object at time t = 0.' },
          { symbol: 'a', name: 'Uniform Acceleration', description: 'Slope of the v-t graph; constant rate of change of velocity.' },
          { symbol: 't', name: 'Time Elapsed', description: 'Duration over which acceleration occurs.' },
          { symbol: 's', name: 'Displacement', description: 'Total distance traveled; equal to the area under the v-t graph.' },
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

  // Dynamic SVG Coordinate Scaling Engine
  const renderDynamicPlot = (plot: CoordinatePlotData) => {
    // 1. Collect all coordinate bounds from data
    const xVals: number[] = [
      ...(plot.x_axis.ticks?.map((t) => t.value) || []),
      ...plot.curves.flatMap((c) => c.points.map((p) => p.x)),
      ...(plot.shaded_areas?.flatMap((a) => a.polygon.map((p) => p.x)) || []),
      ...(plot.projections?.flatMap((pr) => [pr.from_point.x, pr.to_point.x]) || []),
      ...(plot.annotations?.map((a) => a.x) || []),
    ]
    const yVals: number[] = [
      ...(plot.y_axis.ticks?.map((t) => t.value) || []),
      ...plot.curves.flatMap((c) => c.points.map((p) => p.y)),
      ...(plot.shaded_areas?.flatMap((a) => a.polygon.map((p) => p.y)) || []),
      ...(plot.projections?.flatMap((pr) => [pr.from_point.y, pr.to_point.y]) || []),
      ...(plot.annotations?.map((a) => a.y) || []),
    ]

    const minX = xVals.length > 0 ? Math.min(0, ...xVals) : 0
    const maxX = xVals.length > 0 ? Math.max(1, ...xVals) : 10
    const minY = yVals.length > 0 ? Math.min(0, ...yVals) : 0
    const maxY = yVals.length > 0 ? Math.max(1, ...yVals) : 25

    // Canvas & Plotting Viewport
    const svgWidth = 540
    const svgHeight = 330
    const padLeft = 75
    const padRight = 60
    const padTop = 45
    const padBottom = 60

    const plotW = svgWidth - padLeft - padRight
    const plotH = svgHeight - padTop - padBottom

    // Mathematical to SVG Coordinate Transformations
    const scaleX = (x: number) => padLeft + ((x - minX) / (maxX - minX || 1)) * plotW
    const scaleY = (y: number) => svgHeight - padBottom - ((y - minY) / (maxY - minY || 1)) * plotH

    return (
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.02))' }}
      >
        <defs>
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

        {/* 1. Dynamic Shaded Areas */}
        {plot.shaded_areas?.map((area) => {
          const pointsStr = area.polygon.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')
          const centroidX =
            area.polygon.reduce((sum, p) => sum + scaleX(p.x), 0) / (area.polygon.length || 1)
          const centroidY =
            area.polygon.reduce((sum, p) => sum + scaleY(p.y), 0) / (area.polygon.length || 1)

          return (
            <g key={area.id}>
              <motion.polygon
                points={pointsStr}
                fill="#dbeafe"
                fillOpacity={hoveredElement === area.id ? 0.9 : 0.75}
                stroke="#93c5fd"
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredElement(area.id)}
                onMouseLeave={() => setHoveredElement(null)}
              />
              {area.label && (
                <text
                  x={centroidX}
                  y={centroidY}
                  textAnchor="middle"
                  className="font-bold fill-blue-600 text-[17px] tracking-wide pointer-events-none select-none"
                >
                  {area.label}
                </text>
              )}
            </g>
          )
        })}

        {/* 2. Dynamic Dashed Projection Lines */}
        {plot.projections?.map((proj, idx) => (
          <line
            key={idx}
            x1={scaleX(proj.from_point.x)}
            y1={scaleY(proj.from_point.y)}
            x2={scaleX(proj.to_point.x)}
            y2={scaleY(proj.to_point.y)}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray={proj.style === 'dotted' ? '2,3' : '5,5'}
          />
        ))}

        {/* 3. Coordinate Axes with Arrows */}
        {/* Y Axis */}
        <line
          x1={scaleX(minX)}
          y1={scaleY(minY)}
          x2={scaleX(minX)}
          y2={padTop - 12}
          stroke="#1e293b"
          strokeWidth="2.5"
          markerEnd="url(#axis-arrow)"
        />
        <text
          x={scaleX(minX)}
          y={padTop - 22}
          textAnchor="middle"
          className="font-semibold text-[17px] fill-slate-900 select-none"
        >
          {plot.y_axis.label}
        </text>

        {/* X Axis */}
        <line
          x1={scaleX(minX)}
          y1={scaleY(minY)}
          x2={svgWidth - padRight + 20}
          y2={scaleY(minY)}
          stroke="#1e293b"
          strokeWidth="2.5"
          markerEnd="url(#axis-arrow)"
        />
        <text
          x={svgWidth - padRight + 38}
          y={scaleY(minY) + 24}
          textAnchor="start"
          className="font-semibold text-[17px] fill-slate-900 select-none"
        >
          {plot.x_axis.label}
        </text>

        {/* 4. Dynamic Axis Ticks & Labels */}
        {/* X-Axis Ticks */}
        {plot.x_axis.ticks?.map((tick, idx) => (
          <text
            key={idx}
            x={scaleX(tick.value)}
            y={scaleY(minY) + 24}
            textAnchor="middle"
            className="font-serif italic font-semibold text-[17px] fill-slate-900 select-none cursor-pointer"
            onClick={() => {
              const match = variables.find((v) => v.symbol === tick.label)
              if (match) setSelectedVar(match)
            }}
          >
            {tick.label}
          </text>
        ))}

        {/* Y-Axis Ticks */}
        {plot.y_axis.ticks?.map((tick, idx) => (
          <text
            key={idx}
            x={scaleX(minX) - 18}
            y={scaleY(tick.value) + 6}
            textAnchor="end"
            className="font-serif italic font-semibold text-[17px] fill-slate-900 select-none cursor-pointer"
            onClick={() => {
              const match = variables.find((v) => v.symbol === tick.label)
              if (match) setSelectedVar(match)
            }}
          >
            {tick.label}
          </text>
        ))}

        {/* 5. Dynamic Curves & Slopes */}
        {plot.curves.map((curve) => {
          if (curve.points.length < 2) return null
          const pathD = curve.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`)
            .join(' ')

          const midIdx = Math.floor(curve.points.length / 2)
          const midP = curve.points[midIdx]
          const labelX = scaleX(midP.x)
          const labelY = scaleY(midP.y) - 18

          return (
            <g key={curve.id}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="#2563eb"
                strokeWidth={hoveredElement === curve.id ? 5.5 : 4.5}
                strokeLinecap="round"
                strokeDasharray={curve.style === 'dashed' ? '6,6' : undefined}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredElement(curve.id)}
                onMouseLeave={() => setHoveredElement(null)}
              />
              {curve.label && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  className="font-bold fill-blue-600 text-[18px] select-none cursor-pointer"
                  onMouseEnter={() => setHoveredElement(curve.id)}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  {curve.label}
                </text>
              )}
            </g>
          )
        })}

        {/* 6. Dynamic Annotations & Dots */}
        {plot.annotations?.map((ann, idx) => (
          <g key={idx}>
            {ann.point_dot && (
              <circle
                cx={scaleX(ann.x)}
                cy={scaleY(ann.y)}
                r="7"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="cursor-pointer hover:scale-125 transition-transform"
                onClick={() => {
                  const match = variables.find((v) => v.symbol === ann.label)
                  if (match) setSelectedVar(match)
                }}
              />
            )}
            {ann.label && (
              <text
                x={scaleX(ann.x) + 20}
                y={scaleY(ann.y) + 6}
                className="font-serif italic font-semibold text-[17px] fill-slate-900 select-none cursor-pointer"
                onClick={() => {
                  const match = variables.find((v) => v.symbol === ann.label)
                  if (match) setSelectedVar(match)
                }}
              >
                {ann.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    )
  }

  return (
    <div className="w-full py-3 select-none">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all hover:shadow-sm">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h3 className="font-semibold text-sm text-slate-900 tracking-tight">
              {plotData?.title || spec.title || 'Mathematical Model'}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-2xs">
            {plotData ? 'Dynamic 2D Coordinate Plot' : 'Mathematical Formulation'}
          </span>
        </div>

        {/* LLM-Generated Dynamic Coordinate Plot */}
        {plotData && (
          <div className="p-4 sm:p-6 bg-white flex flex-col items-center justify-center border-b border-slate-100">
            <div className="w-full max-w-[540px] relative">
              {renderDynamicPlot(plotData)}

              {mathData?.intuition && (
                <p className="text-xs text-slate-500 text-center mt-2.5 font-medium">
                  {mathData.intuition}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Formula Display */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col items-center justify-center relative">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5">
            <Sigma size={14} /> Key Governing Equation
          </div>

          <div
            className="text-lg sm:text-2xl text-center overflow-x-auto py-1.5 max-w-full text-white"
            dangerouslySetInnerHTML={{ __html: renderedFormulaHtml }}
          />

          {mathData?.intuition && !plotData && (
            <p className="text-xs text-slate-300 text-center mt-2 max-w-lg leading-relaxed italic">
              "{mathData.intuition}"
            </p>
          )}
        </div>

        {/* Interactive Variable Inspection Bar */}
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
