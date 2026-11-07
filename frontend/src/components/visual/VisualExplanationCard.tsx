import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  GitBranch,
  Network,
  GitCompare,
  Sigma,
  Calendar,
  Activity,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Info,
  CheckCircle2,
} from 'lucide-react'
import type { VisualSpecification, VisualNode, VisualType } from '../../types/visual'
import { ProcessDiagramRenderer } from './ProcessDiagramRenderer'
import { StepByStepRenderer } from './StepByStepRenderer'
import { ConceptMapRenderer } from './ConceptMapRenderer'
import { HierarchyDiagramRenderer } from './HierarchyDiagramRenderer'
import { ComparisonDiagramRenderer } from './ComparisonDiagramRenderer'
import { ArchitectureDiagramRenderer } from './ArchitectureDiagramRenderer'
import { MathematicalIllustrationRenderer } from './MathematicalIllustrationRenderer'
import { TimelineRenderer } from './TimelineRenderer'
import { ScientificIllustrationRenderer } from './ScientificIllustrationRenderer'
import { VisualFullscreenModal } from './VisualFullscreenModal'

interface VisualExplanationCardProps {
  spec?: VisualSpecification | null
}

const getVisualTypeMeta = (type: VisualType) => {
  switch (type) {
    case 'process':
      return { label: 'Process Diagram', icon: <Layers size={13} className="text-blue-600" /> }
    case 'step_by_step':
      return { label: 'Step-by-Step Walkthrough', icon: <Sparkles size={13} className="text-blue-600" /> }
    case 'concept_map':
      return { label: 'Concept Map', icon: <Network size={13} className="text-purple-600" /> }
    case 'hierarchy':
      return { label: 'Hierarchy & Taxonomy', icon: <GitBranch size={13} className="text-indigo-600" /> }
    case 'comparison':
      return { label: 'Comparison Matrix', icon: <GitCompare size={13} className="text-amber-600" /> }
    case 'architecture':
      return { label: 'System Architecture', icon: <Layers size={13} className="text-emerald-600" /> }
    case 'mathematical':
      return { label: 'Mathematical Illustration', icon: <Sigma size={13} className="text-blue-600" /> }
    case 'timeline':
      return { label: 'Evolutionary Timeline', icon: <Calendar size={13} className="text-amber-600" /> }
    case 'scientific':
      return { label: 'Scientific Mechanism', icon: <Activity size={13} className="text-teal-600" /> }
    default:
      return { label: 'Interactive Diagram', icon: <Sparkles size={13} className="text-blue-600" /> }
  }
}

export const VisualExplanationCard: React.FC<VisualExplanationCardProps> = ({ spec }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [selectedNode, setSelectedNode] = useState<VisualNode | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)

  // Defensive validation: if spec is missing or visual_required is false, don't render
  if (!spec || !spec.visual_required || !spec.visual_type) {
    return null
  }

  const meta = getVisualTypeMeta(spec.visual_type)
  const nodes = spec.nodes || []

  const handleSelectNode = (node: VisualNode) => {
    setSelectedNode(node)
  }

  // Render the appropriate specialized visual component
  const renderVisualContent = () => {
    switch (spec.visual_type) {
      case 'process':
        return (
          <ProcessDiagramRenderer
            spec={spec}
            activeNodeId={selectedNode?.id}
            onSelectNode={handleSelectNode}
            currentStepIndex={currentStepIndex}
          />
        )
      case 'step_by_step':
        return (
          <StepByStepRenderer
            spec={spec}
            currentStepIndex={currentStepIndex}
            onStepChange={setCurrentStepIndex}
            onSelectNode={handleSelectNode}
          />
        )
      case 'concept_map':
        return (
          <ConceptMapRenderer
            spec={spec}
            activeNodeId={selectedNode?.id}
            onSelectNode={handleSelectNode}
          />
        )
      case 'hierarchy':
        return (
          <HierarchyDiagramRenderer
            spec={spec}
            activeNodeId={selectedNode?.id}
            onSelectNode={handleSelectNode}
          />
        )
      case 'comparison':
        return <ComparisonDiagramRenderer spec={spec} onSelectNode={handleSelectNode} />
      case 'architecture':
        return (
          <ArchitectureDiagramRenderer
            spec={spec}
            activeNodeId={selectedNode?.id}
            onSelectNode={handleSelectNode}
          />
        )
      case 'mathematical':
        return <MathematicalIllustrationRenderer spec={spec} />
      case 'timeline':
        return <TimelineRenderer spec={spec} onSelectNode={handleSelectNode} />
      case 'scientific':
        return (
          <ScientificIllustrationRenderer
            spec={spec}
            activeNodeId={selectedNode?.id}
            onSelectNode={handleSelectNode}
          />
        )
      default:
        // Graceful text fallback if unexpected visual type
        return (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <h4 className="font-semibold text-slate-900 mb-1">{spec.title}</h4>
            <p>{spec.description}</p>
          </div>
        )
    }
  }

  return (
    <>
      <div className="my-3.5 w-full rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-200/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-md bg-white border border-slate-200 shadow-2xs shrink-0">
              {meta.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {meta.label}
                </span>
                {spec.source_references && spec.source_references.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-[9.5px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate">
                    <CheckCircle2 size={10} /> Course Material: {spec.source_references[0]}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                {spec.title}
              </h3>
            </div>
          </div>

          {/* Action buttons: Fullscreen, Expand/Collapse */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Expand to Fullscreen View"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse Figure' : 'Expand Figure'}
            >
              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* Expandable Figure Content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4 sm:p-5 overflow-hidden"
            >
              {/* Overview Description */}
              {spec.description && (
                <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                  {spec.description}
                </p>
              )}

              {/* Specialized Interactive Renderer */}
              {renderVisualContent()}

              {/* Contextual Click Inspection Drawer */}
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-slate-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                      <BookOpen size={13} className="text-blue-600" />
                      Detailed Inspection: {selectedNode.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="text-[10px] text-blue-700 hover:underline cursor-pointer font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedNode.details || selectedNode.description || 'Core stage component in this mechanism.'}
                  </p>
                  {selectedNode.value && (
                    <div className="mt-2 text-[10px] font-mono text-blue-800 bg-white/80 px-2 py-0.5 rounded border border-blue-200 w-fit">
                      Parameter / Value: {selectedNode.value}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Educational Takeaway Caption */}
              {spec.captions && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5 text-xs text-slate-600">
                  <Info size={13} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-slate-800 font-medium">Takeaway: </strong>
                    {spec.captions}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fullscreen Enlarged Modal */}
      <VisualFullscreenModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        spec={spec}
      >
        {renderVisualContent()}
      </VisualFullscreenModal>
    </>
  )
}
