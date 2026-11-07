import React, { useState } from 'react'
import { motion } from 'framer-motion'
import katex from 'katex'
import { Sigma, Sparkles, Info, BookOpen } from 'lucide-react'
import type { VisualSpecification, MathVariable } from '../../types/visual'

interface MathematicalIllustrationRendererProps {
  spec: VisualSpecification
}

export const MathematicalIllustrationRenderer: React.FC<MathematicalIllustrationRendererProps> = ({ spec }) => {
  const mathData = spec.math_data
  const primaryFormula = mathData?.primary_formula || '$$ f(x) = \\sigma(W^T x + b) $$'
  const rawLatex = primaryFormula.replace(/^\$\$|\$\$$/g, '').trim()

  const variables: MathVariable[] =
    mathData?.variables && mathData.variables.length > 0
      ? mathData.variables
      : [
          { symbol: 'W', name: 'Weight Matrix', description: 'Trainable parameters determining feature significance.' },
          { symbol: 'x', name: 'Input Vector', description: 'Raw feature vector or embedding passed into the layer.' },
          { symbol: 'b', name: 'Bias Term', description: 'Affine offset allowing the model to shift the activation curve.' },
          { symbol: '\\sigma', name: 'Activation Function', description: 'Non-linear transformation introducing expressive power.' },
        ]

  const [selectedVar, setSelectedVar] = useState<MathVariable>(variables[0])

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
    <div className="w-full py-4 select-none">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        {/* Formula Hero Banner */}
        <div className="p-5 bg-slate-900 text-white flex flex-col items-center justify-center relative">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">
            <Sigma size={14} /> Mathematical Formulation
          </div>

          <div
            className="text-lg sm:text-2xl text-center overflow-x-auto py-2 max-w-full text-white"
            dangerouslySetInnerHTML={{ __html: renderedFormulaHtml }}
          />

          {mathData?.intuition && (
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
