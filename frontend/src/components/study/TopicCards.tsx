export interface TopicItem {
  id: string
  title: string
  summary: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | string
  key_concepts?: string[]
  estimated_study_time?: string
}

