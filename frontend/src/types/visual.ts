/**
 * Dynamic Visual Explanation Engine — Frontend Type Definitions
 * Strict semantic schema for all 9 visual types without arbitrary HTML/SVG code.
 */

export type VisualType =
  | 'process'
  | 'step_by_step'
  | 'concept_map'
  | 'hierarchy'
  | 'comparison'
  | 'architecture'
  | 'mathematical'
  | 'timeline'
  | 'scientific'

export interface VisualNode {
  id: string
  label: string
  description?: string
  details?: string
  category?: string
  icon_hint?: string
  status?: string
  value?: string
  level?: number
}

export interface VisualConnection {
  from_node: string
  to_node: string
  label?: string
  direction?: 'forward' | 'bidirectional' | 'dashed' | 'dotted' | string
  style?: string
}

export interface ComparisonDimension {
  dimension: string
  concept_a_value: string
  concept_b_value: string
  concept_c_value?: string
}

export interface MathVariable {
  symbol: string
  name: string
  description: string
}

export interface MathIllustrationData {
  primary_formula: string
  variables?: MathVariable[]
  graph_type?: string
  intuition?: string
}

export interface TimelineItem {
  time_period: string
  title: string
  summary: string
  significance?: string
}

export interface VisualSpecification {
  visual_required: boolean
  visual_type: VisualType
  title: string
  description: string
  nodes?: VisualNode[]
  connections?: VisualConnection[]
  labels?: string[]
  captions?: string
  explanatory_content?: string
  source_references?: string[]
  comparison_data?: ComparisonDimension[]
  math_data?: MathIllustrationData
  timeline_data?: TimelineItem[]
}
