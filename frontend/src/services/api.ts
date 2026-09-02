import axios from 'axios'

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim()
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '')
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`
  }
  return '/api'
}


const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

// ─── Health ───────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health'),
}

export interface StudySessionMeta {
  session_id: string
  title: string
  subject: string
  created_at: string
  last_active: string
  topics_count: number
  messages_count: number
}

// ─── Study API ────────────────────────────────────────────────
export const studyApi = {
  listSessions: () => api.get<StudySessionMeta[]>('/study/sessions'),
  createSession: (data?: { subject?: string; title?: string }) =>
    api.post<StudySessionMeta>('/study/sessions/new', data || {}),
  getSessionState: (sessionId: string) => api.get(`/study/sessions/${sessionId}`),
  saveSessionState: (
    sessionId: string,
    data: {
      messages?: any[]
      topics?: any[]
      subject?: string
      title?: string
    }
  ) => api.post(`/study/sessions/${sessionId}/state`, data),
  deleteSession: (sessionId: string) => api.delete(`/study/sessions/${sessionId}`),

  agentMessage: (data: {
    message: string
    current_subject?: string
    session_id?: string
    user_id?: string
    user_name?: string
    difficulty?: 'standard' | 'easier'
    history?: { role: string; content: string }[]
  }) => api.post('/study/agent/message', data),
  sendFeedback: (data: {
    user_id?: string
    action: 'confirm_good' | 'make_easier'
    concept?: string
    subject?: string
  }) => api.post('/study/feedback', data),
  upload: (subject: string, file: File, sessionId?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('subject', subject)
    if (sessionId) form.append('session_id', sessionId)
    return api.post('/study/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  session: (studyId: string) => api.get(`/study/session/${studyId}`),

  getMemory: (userId: string = 'default_user') => api.get(`/study/memory/${userId}`),
  updateMemory: (userId: string, data: { fact?: string; learning_style?: string; goal?: string; weakness?: string }) =>
    api.post(`/study/memory/${userId}/fact`, data),
  clearMemory: (userId: string) => api.delete(`/study/memory/${userId}`),
  coreIdea: (data: { session_id: string; topic_id: string; topic_title: string; topic_summary?: string }) =>
    api.post('/study/topic/core-idea', data),

  askDoubt: (data: {
    session_id: string
    topic_id: string
    topic_title: string
    question: string
    user_id?: string
    history?: { role: string; content: string }[]
  }) => api.post('/study/topic/doubt', data),
  generateExam: (data: { session_id: string; topic_id: string; topic_title: string }) =>
    api.post('/study/topic/exam', data),
  evaluateExam: (data: {
    session_id: string
    topic_id: string
    questions: any[]
    answers: Record<string, string>
  }) => api.post('/study/topic/evaluate', data),
  exportNotesMd: (markdown: string, title?: string) =>
    api.post('/export/notes-md', { markdown, title: title || 'study_notes' }, { responseType: 'blob' }),
}


export const streamTeacherLesson = async ({
  sessionId,
  topicId,
  topicTitle,
  token,
  onToken,
  onDone,
  onError,
  signal,
}: {
  sessionId: string
  topicId: string
  topicTitle: string
  token?: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (err: any) => void
  signal?: AbortSignal
}) => {
  try {
    const baseUrl = getApiBaseUrl()
    const url = `${baseUrl}/study/topic/teach/stream?session_id=${encodeURIComponent(sessionId)}&topic_id=${encodeURIComponent(topicId)}&topic_title=${encodeURIComponent(topicTitle)}`
    const headers: Record<string, string> = { Accept: 'text/event-stream' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(url, { headers, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    if (!res.body) throw new Error('ReadableStream not supported')

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(trimmed.slice(6))
          if (evt.type === 'token') onToken(evt.data)
          else if (evt.type === 'done') {
            onDone()
            return
          }
        } catch {
          // ignore partial JSON frame
        }
      }
    }
    onDone()
  } catch (err: any) {
    if (err.name === 'AbortError') return
    onError(err)
  }
}

export default api
